// PROTOTYPE — throwaway. Answers "Does Knock hold up against Cadence?"
// (https://github.com/ian0/cohort-005-project/issues/18). Never merge to main.
//
// Everything Knock-side on this page (feed, unread count, mark read/seen) runs
// in the browser against Knock's headless API with the public key plus a
// user token our server signed for whoever the DevUI switcher selected.
import { useCallback, useEffect, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock";
import { db } from "~/db";
import { courses, users, CourseStatus } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { Button } from "~/components/ui/button";
import {
  feedConfig,
  getPreferences,
  knockUserId,
  notifyEnrollment,
  resetPreferences,
  setEnrollmentInFeed,
  signFeedToken,
  ENROLLMENT_CATEGORY,
  WORKFLOW_DISCUSSION_REPLY,
  WORKFLOW_ENROLLMENT,
} from "~/lib/knock.prototype.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw data("User not found", { status: 404 });

  const courseList = db
    .select({
      id: courses.id,
      title: courses.title,
      instructorId: courses.instructorId,
      instructorName: users.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .where(eq(courses.status, CourseStatus.Published))
    .all();

  return {
    user: { id: user.id, name: user.name, role: user.role },
    knockUserId: knockUserId(user.id),
    // Someone else's Knock id, to prove our token can't read their feed.
    otherKnockUserId: knockUserId(user.id === 5 ? 6 : 5),
    userToken: await signFeedToken(user.id),
    ...feedConfig(),
    preferences: await getPreferences(user.id),
    courses: courseList,
    workflows: [WORKFLOW_DISCUSSION_REPLY, WORKFLOW_ENROLLMENT],
    enrollmentCategory: ENROLLMENT_CATEGORY,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user", { status: 401 });
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "simulate-enrollment") {
      const result = await notifyEnrollment(userId, Number(form.get("courseId")));
      return { intent, result };
    }
    if (intent === "mute-enrollment") {
      return { intent, result: await setEnrollmentInFeed(userId, false) };
    }
    if (intent === "unmute-enrollment") {
      return { intent, result: await setEnrollmentInFeed(userId, true) };
    }
    if (intent === "reset-preferences") {
      await resetPreferences(userId);
      return { intent, result: "preference set removed" };
    }
  } catch (error) {
    return { intent, error: String(error) };
  }
  throw data("Unknown intent", { status: 400 });
}

// ─── Headless feed client (the bit we'd build on) ───

type FeedItem = {
  id: string;
  inserted_at: string;
  read_at: string | null;
  seen_at: string | null;
  source: { key: string };
  blocks: { name: string; rendered: string }[];
  data: Record<string, unknown> | null;
  actors: { id: string; name?: string }[];
};
type FeedResponse = {
  entries: FeedItem[];
  meta: { unread_count: number; unseen_count: number; total_count: number };
};

function useKnockApi(publicApiKey: string, userToken: string) {
  return useCallback(
    async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`https://api.knock.app${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${publicApiKey}`,
          "X-Knock-User-Token": userToken,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json: unknown = text;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, json };
    },
    [publicApiKey, userToken]
  );
}

function decodeJwt(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export default function KnockPrototype({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const api = useKnockApi(d.publicApiKey, d.userToken);
  const navigation = useNavigation();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [lastCall, setLastCall] = useState<{ label: string; status: number; json: unknown } | null>(null);
  const [crossUser, setCrossUser] = useState<{ status: number; json: unknown } | null>(null);

  const feedPath = `/v1/users/${d.knockUserId}/feeds/${d.feedChannelId}`;

  const loadFeed = useCallback(async () => {
    const r = await api("GET", `${feedPath}?page_size=20`);
    setLastCall({ label: `GET ${feedPath}`, ...r });
    if (r.status === 200) setFeed(r.json as FeedResponse);
    else setFeed(null);
  }, [api, feedPath]);

  // Reload whenever the user (token) changes, and poll every 5s.
  useEffect(() => {
    setFeed(null);
    setCrossUser(null);
    loadFeed();
    const t = setInterval(loadFeed, 5000);
    return () => clearInterval(t);
  }, [loadFeed]);

  async function batch(status: "read" | "seen" | "unread" | "unseen", ids: string[]) {
    if (ids.length === 0) return;
    const r = await api("POST", `/v1/messages/batch/${status}`, { message_ids: ids });
    setLastCall({ label: `POST /v1/messages/batch/${status}`, ...r });
    await loadFeed();
  }

  async function tryOtherFeed() {
    const r = await api("GET", `/v1/users/${d.otherKnockUserId}/feeds/${d.feedChannelId}`);
    setCrossUser(r);
  }

  const claims = decodeJwt(d.userToken);
  const busy = navigation.state !== "idle";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 text-sm">
      <div className="rounded-md border-2 border-dashed border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/30">
        <h1 className="text-xl font-bold">PROTOTYPE · Does Knock hold up against Cadence?</h1>
        <p className="mt-1 text-muted-foreground">
          Throwaway page. Switch users in the DevUI panel; everything below follows the selected user.
          Signed in as <b>{d.user.name}</b> ({d.user.role}) → Knock user id <code>{d.knockUserId}</code>.
        </p>
      </div>

      {/* 1. Signed user tokens */}
      <Section n={1} title="Signed user tokens">
        <p>Our server signed this RS256 token for the selected user. The feed below authenticates with it.</p>
        <Kv k="sub" v={claims?.sub} />
        <Kv k="expires" v={claims?.exp ? new Date(claims.exp * 1000).toLocaleString() : "?"} />
        <Kv k="last feed call" v={lastCall ? `${lastCall.label} → ${lastCall.status}` : "…"} />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={tryOtherFeed}>
            Try to read user {d.otherKnockUserId}'s feed with this token
          </Button>
          {crossUser && (
            <span className={crossUser.status === 200 ? "text-red-600" : "text-green-700"}>
              → {crossUser.status} {crossUser.status === 200 ? "LEAK (fail)" : "refused (pass)"}
            </span>
          )}
        </div>
        {crossUser && <Pre value={crossUser.json} />}
      </Section>

      {/* 2 + 3. Feed */}
      <Section n={3} title="Notification Feed (headless API, from the browser)">
        <div className="flex flex-wrap items-center gap-3">
          <Badge label="unread" value={feed?.meta.unread_count} />
          <Badge label="unseen" value={feed?.meta.unseen_count} />
          <Badge label="total" value={feed?.meta.total_count} />
          <Button size="sm" variant="outline" onClick={loadFeed}>Refresh</Button>
          <Button size="sm" variant="outline" onClick={() => batch("seen", feed?.entries.filter((e) => !e.seen_at).map((e) => e.id) ?? [])}>
            Mark all seen
          </Button>
          <Button size="sm" variant="outline" onClick={() => batch("read", feed?.entries.filter((e) => !e.read_at).map((e) => e.id) ?? [])}>
            Mark all read
          </Button>
          <span className="text-muted-foreground">polls every 5s</span>
        </div>
        {!feed && <p className="mt-3 text-muted-foreground">No feed loaded (see last call status above).</p>}
        {feed && feed.entries.length === 0 && <p className="mt-3 text-muted-foreground">Empty feed.</p>}
        <ul className="mt-3 divide-y rounded border">
          {feed?.entries.map((e) => (
            <li key={e.id} className={`flex items-start gap-3 p-3 ${e.read_at ? "opacity-60" : ""}`}>
              <span className={`mt-1 size-2 shrink-0 rounded-full ${e.read_at ? "bg-transparent" : "bg-blue-500"}`} />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">
                  {e.source.key} · {new Date(e.inserted_at).toLocaleString()} · seen {e.seen_at ? "✓" : "✗"} · read {e.read_at ? "✓" : "✗"}
                </div>
                <div
                  className="prose prose-sm dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: e.blocks.find((b) => b.name === "body")?.rendered ?? "(no body block)" }}
                />
                {typeof e.data?.url === "string" && (
                  <a className="text-xs text-blue-600 underline" href={e.data.url}>open</a>
                )}
              </div>
              <div className="flex gap-1">
                {e.read_at ? (
                  <Button size="xs" variant="ghost" onClick={() => batch("unread", [e.id])}>Mark unread</Button>
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => batch("read", [e.id])}>Mark read</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {lastCall && <Pre value={lastCall.json} collapsed />}
      </Section>

      <Section n={2} title="Real trigger: Discussion Reply">
        <p>
          Not triggered from here. The real <code>create-comment</code> action on a lesson page now calls
          Knock's Node SDK when the comment is a Discussion Reply. Post a Discussion Reply as one user, then
          switch to the Discussion Question's author and watch their feed above. The server logs
          <code> [knock prototype] discussion-reply</code> with the result.
        </p>
      </Section>

      {/* 4. Preferences */}
      <Section n={4} title="Preferences: Enrollment, on by default, mutable">
        <p>
          Simulate <b>{d.user.name}</b> getting an Enrollment on a course; the course's Instructor is notified
          (workflow <code>{d.workflows[1]}</code>, category <code>{d.enrollmentCategory}</code>).
        </p>
        <Form method="post" className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="intent" value="simulate-enrollment" />
          <select name="courseId" className="rounded border bg-background px-2 py-1">
            {d.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} (Instructor: {c.instructorName}, Knock id {c.instructorId})
              </option>
            ))}
          </select>
          <Button size="sm" disabled={busy}>Simulate new Enrollment</Button>
        </Form>

        <p className="mt-4">
          Mute / unmute <b>{d.user.name}</b>'s Enrollment Notifications in the Notification Feed
          (category <code>{d.enrollmentCategory}</code> × channel type <code>in_app_feed</code>):
        </p>
        <div className="mt-2 flex gap-2">
          {(["mute-enrollment", "unmute-enrollment", "reset-preferences"] as const).map((intent) => (
            <Form method="post" key={intent}>
              <input type="hidden" name="intent" value={intent} />
              <Button size="sm" variant="outline" disabled={busy}>{intent}</Button>
            </Form>
          ))}
        </div>
        <h3 className="mt-4 font-semibold">Knock preference set (default) for {d.user.name}</h3>
        <Pre value={d.preferences} />
        {actionData && (
          <>
            <h3 className="mt-4 font-semibold">Last action: {String(actionData.intent)}</h3>
            <Pre value={actionData} />
          </>
        )}
      </Section>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border p-4">
      <h2 className="mb-2 text-base font-semibold">
        <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs">criterion {n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Kv({ k, v }: { k: string; v: unknown }) {
  return (
    <div>
      <span className="inline-block w-32 text-muted-foreground">{k}</span>
      <code>{String(v)}</code>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: number | undefined }) {
  return (
    <span className="rounded-full bg-muted px-3 py-1">
      {label}: <b>{value ?? "–"}</b>
    </span>
  );
}

function Pre({ value, collapsed }: { value: unknown; collapsed?: boolean }) {
  const body = (
    <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
  return collapsed ? (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">raw response</summary>
      {body}
    </details>
  ) : (
    body
  );
}
