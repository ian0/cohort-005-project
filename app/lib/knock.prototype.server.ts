// PROTOTYPE — throwaway. Answers "Does Knock hold up against Cadence?"
// (https://github.com/ian0/cohort-005-project/issues/18). Lives on the
// prototype/knock-holds-up branch only; never merge to main.
import Knock, { signUserToken } from "@knocklabs/node";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { comments, courses, lessons, modules, users } from "~/db/schema";

const knock = new Knock(); // reads KNOCK_API_KEY

export const WORKFLOW_DISCUSSION_REPLY = "discussion-reply";
export const WORKFLOW_ENROLLMENT = "new-enrollment";
export const ENROLLMENT_CATEGORY = "enrollment";

// Default chosen for the prototype: Cadence user id as a string.
export function knockUserId(userId: number) {
  return String(userId);
}

function recipientFor(userId: number) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error(`No user ${userId}`);
  // Inline-identify on every trigger, so Knock always has name + email.
  return { id: knockUserId(user.id), name: user.name, email: user.email };
}

export async function signFeedToken(userId: number) {
  return signUserToken(knockUserId(userId), { expiresInSeconds: 60 * 60 });
}

export function feedConfig() {
  return {
    publicApiKey: process.env.KNOCK_PUBLIC_API_KEY ?? "",
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? "",
  };
}

/**
 * Discussion Reply → the Discussion Question's author, unless they wrote the
 * reply. Called from the real create-comment action on the lesson page.
 */
export async function notifyDiscussionReply(reply: {
  id: number;
  userId: number;
  lessonId: number;
  parentId: number | null;
  body: string;
}) {
  if (reply.parentId === null) return { skipped: "not a Discussion Reply" };

  const question = db
    .select()
    .from(comments)
    .where(eq(comments.id, reply.parentId))
    .get();
  if (!question) return { skipped: "question not found" };
  if (question.userId === reply.userId) {
    return { skipped: "author replied to their own Discussion Question" };
  }

  const lesson = db
    .select({
      lessonTitle: lessons.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, reply.lessonId))
    .get();
  if (!lesson) return { skipped: "lesson not found" };

  return knock.workflows.trigger(WORKFLOW_DISCUSSION_REPLY, {
    recipients: [recipientFor(question.userId)],
    actor: recipientFor(reply.userId),
    data: {
      lesson_title: lesson.lessonTitle,
      course_title: lesson.courseTitle,
      url: `/courses/${lesson.courseSlug}/lessons/${reply.lessonId}#comment-${reply.id}`,
      reply_excerpt: reply.body.slice(0, 140),
    },
  });
}

/** Enrollment → the course's Instructor. Simulated from the prototype page. */
export async function notifyEnrollment(studentId: number, courseId: number) {
  const course = db.select().from(courses).where(eq(courses.id, courseId)).get();
  if (!course) throw new Error(`No course ${courseId}`);
  if (course.instructorId === studentId) {
    return { skipped: "Instructor enrolled on their own course" };
  }
  return knock.workflows.trigger(WORKFLOW_ENROLLMENT, {
    recipients: [recipientFor(course.instructorId)],
    actor: recipientFor(studentId),
    data: {
      course_title: course.title,
      url: `/instructor/${course.id}/students`,
    },
  });
}

export async function getPreferences(userId: number) {
  try {
    return await knock.users.getPreferences(knockUserId(userId), "default");
  } catch (error) {
    return { error: String(error) };
  }
}

/** category × channel: mute only the in-app feed for the Enrollment category. */
export async function setEnrollmentInFeed(userId: number, on: boolean) {
  // Make sure the user exists in Knock before writing preferences.
  const r = recipientFor(userId);
  await knock.users.update(r.id, { name: r.name, email: r.email });
  return knock.users.setPreferences(r.id, "default", {
    __persistence_strategy__: "merge",
    categories: {
      [ENROLLMENT_CATEGORY]: { channel_types: { in_app_feed: on } },
    },
  });
}

export async function resetPreferences(userId: number) {
  return knock.users.unsetPreferences(knockUserId(userId), "default");
}
