// PROTOTYPE — throwaway. Answers "What does the Notification Feed look like in
// Cadence?" (https://github.com/ian0/cohort-005-project/issues/16). Lives on
// the prototype/notification-feed branch only; never merge to main.
import Knock, { signUserToken } from "@knocklabs/node";
import { eq, ne } from "drizzle-orm";
import { db } from "~/db";
import { courses, lessons, modules, users } from "~/db/schema";

const knock = new Knock(); // reads KNOCK_API_KEY

// One generic workflow renders whatever body we hand it, so the prototype can
// fake every Notification in the catalogue without eight real workflows.
export const SAMPLE_WORKFLOW = "prototype-feed-sample";

export type NotificationKind =
  | "open-refund-request"
  | "approved-refund-request"
  | "declined-refund-request"
  | "claimed-seat"
  | "discussion-question"
  | "discussion-reply"
  | "new-enrollment"
  | "rating";

function person(userId: number) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error(`No user ${userId}`);
  return { id: String(user.id), name: user.name, email: user.email };
}

export async function signFeedToken(userId: number) {
  return signUserToken(String(userId), { expiresInSeconds: 60 * 60 });
}

export function feedConfig() {
  return {
    publicApiKey: process.env.KNOCK_PUBLIC_API_KEY ?? "",
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? "",
  };
}

/**
 * Sends the current user one of every Notification in the catalogue, with
 * real names, courses and lessons from the database, so each variant has a
 * realistic feed to render.
 */
export async function sendSampleNotifications(userId: number) {
  const others = db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.id, userId))
    .all()
    .map((u) => u.id);
  const pick = (i: number) => person(others[i % others.length]);

  const course = db.select().from(courses).limit(1).get()!;
  const lesson = db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, course.id))
    .limit(1)
    .get()!;
  const lessonUrl = `/courses/${course.slug}/lessons/${lesson.id}`;

  const samples: {
    kind: NotificationKind;
    actor: ReturnType<typeof person>;
    body: string;
    url: string;
  }[] = [
    {
      kind: "rating",
      actor: pick(5),
      body: `**${pick(5).name}** rated *${course.title}* ★★★★☆`,
      url: `/courses/${course.slug}`,
    },
    {
      kind: "new-enrollment",
      actor: pick(4),
      body: `**${pick(4).name}** enrolled on *${course.title}*`,
      url: `/instructor/${course.id}/students`,
    },
    {
      kind: "claimed-seat",
      actor: pick(3),
      body: `**${pick(3).name}** claimed a Seat on *${course.title}*`,
      url: `/team`,
    },
    {
      kind: "declined-refund-request",
      actor: pick(0),
      body: `Your Refund Request for *${course.title}* was declined: "You've watched most of the course."`,
      url: `/settings`,
    },
    {
      kind: "approved-refund-request",
      actor: pick(0),
      body: `Your Refund Request for *${course.title}* was approved`,
      url: `/settings`,
    },
    {
      kind: "open-refund-request",
      actor: pick(6),
      body: `**${pick(6).name}** asked for a refund on *${course.title}*: "The course wasn't what I expected."`,
      url: `/admin/refunds`,
    },
    {
      kind: "discussion-question",
      actor: pick(2),
      body: `**${pick(2).name}** asked a Discussion Question on *${lesson.title}*`,
      url: lessonUrl,
    },
    {
      kind: "discussion-reply",
      actor: pick(1),
      body: `**${pick(1).name}** replied to your Discussion Question on *${lesson.title}*`,
      url: lessonUrl,
    },
  ];

  const recipient = person(userId);
  for (const s of samples) {
    await knock.workflows.trigger(SAMPLE_WORKFLOW, {
      recipients: [recipient],
      actor: s.actor,
      data: { kind: s.kind, body: s.body, url: s.url },
    });
  }
  return { sent: samples.length };
}
