// PROTOTYPE — throwaway. Creates (or updates) and commits the two Knock
// workflows the "Does Knock hold up against Cadence?" prototype needs, in the
// Development environment, via Knock's Management API.
// Run from the repo root:
//   node --use-system-ca --env-file=.env scripts/knock-prototype-push-workflows.mjs
const token = process.env.KNOCK_SERVICE_TOKEN;
if (!token) {
  console.error("KNOCK_SERVICE_TOKEN is not set in .env");
  process.exit(1);
}

const CHANNEL_KEY = "in-app"; // the In-app feed channel Knock created for us

const workflows = {
  "discussion-reply": {
    name: "Discussion Reply",
    categories: [],
    markdown_body:
      "**{{ actor.name }}** replied to your Discussion Question on *{{ data.lesson_title }}* ({{ data.course_title }})",
  },
  "new-enrollment": {
    name: "New Enrollment",
    categories: ["enrollment"],
    markdown_body: "**{{ actor.name }}** enrolled on *{{ data.course_title }}*",
  },
};

async function call(method, path, body) {
  const res = await fetch(`https://control.knock.app/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

let failed = false;

// Workflow categories must already exist in the account's preference category
// catalog. Upserting returns the existing one if it's already there.
for (const name of new Set(Object.values(workflows).flatMap((w) => w.categories))) {
  try {
    await call("PUT", `/preference_categories/${name}`);
    console.log(`  ✓ preference category "${name}" exists`);
  } catch (e) {
    failed = true;
    console.log(`  ✗ preference category "${name}": ${e.message}`);
  }
}

for (const [key, wf] of Object.entries(workflows)) {
  try {
    const qs = new URLSearchParams({
      environment: "development",
      commit: "true",
      commit_message: `Knock prototype: ${wf.name}`,
    });
    const { workflow } = await call("PUT", `/workflows/${key}?${qs}`, {
      workflow: {
        name: wf.name,
        categories: wf.categories,
        steps: [
          {
            type: "channel",
            ref: "in_app_feed_1",
            name: "In-app feed",
            channel_key: CHANNEL_KEY,
            template: { markdown_body: wf.markdown_body, action_url: "{{ data.url }}" },
          },
        ],
      },
    });
    await call("PUT", `/workflows/${key}/activate?environment=development`, { status: true });
    console.log(
      `  ✓ ${key}: committed and active (categories: ${workflow.categories?.join(", ") || "none"}, valid: ${workflow.valid})`
    );
  } catch (e) {
    failed = true;
    console.log(`  ✗ ${key}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
