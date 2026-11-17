// PROTOTYPE — throwaway. Creates and commits the one generic Knock workflow the
// Notification Feed prototype triggers, in the Development environment.
// Run from the repo root:
//   node --use-system-ca --env-file=.env scripts/notification-feed-prototype-push-workflow.mjs
const token = process.env.KNOCK_SERVICE_TOKEN;
if (!token) {
  console.error("KNOCK_SERVICE_TOKEN is not set in .env");
  process.exit(1);
}

const key = "prototype-feed-sample";
const qs = new URLSearchParams({
  environment: "development",
  commit: "true",
  commit_message: "Notification Feed prototype: generic sample workflow",
});

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

const { workflow } = await call("PUT", `/workflows/${key}?${qs}`, {
  workflow: {
    name: "Prototype: Notification Feed sample",
    categories: [],
    steps: [
      {
        type: "channel",
        ref: "in_app_feed_1",
        name: "In-app feed",
        channel_key: "in-app",
        template: { markdown_body: "{{ data.body }}", action_url: "{{ data.url }}" },
      },
    ],
  },
});
await call("PUT", `/workflows/${key}/activate?environment=development`, { status: true });
console.log(`✓ ${key}: committed and active (valid: ${workflow.valid})`);
