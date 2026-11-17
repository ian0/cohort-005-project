// PROTOTYPE — throwaway. The /notifications page for variant B of the
// Notification Feed prototype, and the "Send me samples" action every variant
// uses. Never merge to main.
import { data } from "react-router";
import type { Route } from "./+types/notifications.prototype";
import { getCurrentUserId } from "~/lib/session";
import { sendSampleNotifications } from "~/lib/notification-feed.prototype.server";
import { VariantBPage } from "~/components/notification-feed.prototype";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel.", { status: 401 });
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel.", { status: 401 });
  return sendSampleNotifications(userId);
}

export default function NotificationsPrototype() {
  return <VariantBPage />;
}
