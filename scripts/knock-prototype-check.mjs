// PROTOTYPE — throwaway. Checks the two Knock workflows the "Does Knock hold up
// against Cadence?" prototype needs are committed and behave. Run from the repo
// root: node --use-system-ca --env-file=.env scripts/knock-prototype-check.mjs
//
// Uses a throwaway Knock user ("wizard-probe") and deletes it at the end.
import Knock from "@knocklabs/node";

const knock = new Knock(); // KNOCK_API_KEY
const channel = process.env.KNOCK_FEED_CHANNEL_ID;
const probe = { id: "wizard-probe", name: "Wizard Probe" };
const actor = { id: "wizard-probe-actor", name: "Probe Actor" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
  failed = true;
  console.log(`  ✗ ${msg}`);
};

async function feed() {
  const res = await fetch(
    `https://api.knock.app/v1/users/${probe.id}/feeds/${channel}?page_size=50`,
    { headers: { Authorization: `Bearer ${process.env.KNOCK_API_KEY}` } }
  );
  if (!res.ok) throw new Error(`feed ${res.status}: ${await res.text()}`);
  return (await res.json()).entries;
}

// Trigger, then wait up to `ms` for a new feed item from that workflow.
async function triggerAndWait(key, data, ms = 10000) {
  const before = new Set((await feed()).map((e) => e.id));
  try {
    await knock.workflows.trigger(key, { recipients: [probe], actor, data });
  } catch (e) {
    if (e.status === 404) return { missing: true };
    throw e;
  }
  for (let waited = 0; waited < ms; waited += 1000) {
    await sleep(1000);
    const item = (await feed()).find((e) => !before.has(e.id) && e.source?.key === key);
    if (item) return { item };
  }
  return {};
}

function body(item) {
  return item.blocks?.find((b) => b.name === "body")?.rendered?.replace(/<[^>]+>/g, "").trim();
}

try {
  await knock.users.update(probe.id, { name: probe.name });
  await knock.users.update(actor.id, { name: actor.name });
  await knock.users.unsetPreferences(probe.id, "default").catch(() => {});

  console.log("discussion-reply");
  const reply = await triggerAndWait("discussion-reply", {
    lesson_title: "Your First TypeScript Program",
    course_title: "Introduction to TypeScript",
    url: "/courses/introduction-to-typescript/lessons/3",
    reply_excerpt: "probe",
  });
  if (reply.missing) bad("workflow not found: create it and commit it to Development");
  else if (!reply.item) bad("triggered, but nothing reached the feed: does it have an In-app feed step on the in-app channel?");
  else {
    ok(`reached the feed: "${body(reply.item)}"`);
    if (!body(reply.item)?.includes("Probe Actor")) bad("body doesn't show the actor's name: check {{ actor.name }} in the template");
    if (reply.item.data?.url) ok("click action data present");
  }

  console.log("new-enrollment");
  const on = await triggerAndWait("new-enrollment", {
    course_title: "Introduction to TypeScript",
    url: "/instructor/1/students",
  });
  if (on.missing) bad("workflow not found: create it and commit it to Development");
  else if (!on.item) bad("triggered, but nothing reached the feed: does it have an In-app feed step on the in-app channel?");
  else {
    ok(`on by default, reached the feed: "${body(on.item)}"`);

    await knock.users.setPreferences(probe.id, "default", {
      categories: { enrollment: { channel_types: { in_app_feed: false } } },
    });
    const muted = await triggerAndWait("new-enrollment", { course_title: "x", url: "/" }, 6000);
    if (muted.item) bad("still delivered after muting the enrollment category: add the category `enrollment` (Manage workflow) and commit");
    else ok("muted via category `enrollment` × in_app_feed: nothing delivered");
  }
} catch (e) {
  bad(`unexpected error: ${e.message}`);
} finally {
  await knock.users.delete(probe.id).catch(() => {});
  await knock.users.delete(actor.id).catch(() => {});
}

console.log(failed ? "\nNOT READY" : "\nREADY");
process.exit(failed ? 1 : 0);
