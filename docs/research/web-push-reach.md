# How far can web push reach without a native app?

Research for [ian0/cohort-005-project#3](https://github.com/ian0/cohort-005-project/issues/3), part of the map [Notifications in Cadence](https://github.com/ian0/cohort-005-project/issues/1).

**Question.** Cadence has no mobile app. How far can browser web push reach its Students, Instructors, Team Admins and Platform Admins? Is web push credible as Cadence's second **Channel**, compared with email? (The **Notification Feed** is already fixed as the first Channel.)

All claims below cite primary sources: browser vendors, specs, and MDN's browser-compat data. Sources were checked in this research session.

---

## 1. What web push is

Web push is built from three W3C standards working together: the Push API, the Notifications API and Service Workers ([WebKit, "Meet Web Push"](https://webkit.org/blog/12945/meet-web-push/)). The page registers a service worker and calls `PushManager.subscribe()`. The resulting `PushSubscription` holds an endpoint URL and encryption keys. The server sends encrypted messages to that endpoint. The browser wakes the service worker, which shows a Notification ([MDN, Push API](https://github.com/mdn/content/blob/main/files/en-us/web/api/push_api/index.md)). The wire protocol is IETF RFC 8030 ([RFC 8030](https://www.rfc-editor.org/rfc/rfc8030)).

Each browser vendor runs its own push service. Apple's is APNs (`*.push.apple.com`). No Apple Developer Program membership is needed ([Apple, Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).

## 2. Browser support (reach)

`PushManager` support from MDN's browser-compat data ([BCD api.PushManager](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.PushManager.json)):

| Browser | Since | Caveat |
| --- | --- | --- |
| Chrome (desktop) | 42 | — |
| Chrome for Android | 42 | — |
| Edge | 17 | — |
| Firefox (desktop) | 44 | — |
| Firefox for Android | 48 | — |
| Samsung Internet | 4.0 | — |
| Opera / Opera Android | 29 | — |
| Safari (macOS) | 16 | "Notifications are supported on macOS Ventura and later." |
| Safari on iOS/iPadOS | 16.4 | "Notifications are supported in web apps saved to the home screen." |
| Android WebView | ✗ | Not supported. In-app browsers built on WebView can't subscribe. |
| iOS WKWebView | ✗ | Home-screen web apps only. |

**Desktop.** Every current major browser is covered. Safari needs macOS 13 Ventura or later ([WebKit, Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)).

On desktop, a push arrives only while the browser process is running. It can run in the background with no windows open. If the browser is fully closed, nothing arrives until it starts again ([web.dev, Push notifications FAQ](https://web.dev/articles/push-notifications-faq)). Safari on macOS is the exception. Its `webpushd` daemon means "Safari doesn't even need to be running for a push message to be delivered" ([WebKit, Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)).

**Android.** The OS wakes the browser when a push arrives, even if the browser is closed ([web.dev, Push notifications FAQ](https://web.dev/articles/push-notifications-faq)). Web push therefore behaves much like native push on Android. Chrome, Firefox and Samsung Internet are all supported (BCD above).

## 3. iOS and iPadOS: the home-screen requirement

This is the biggest limit on reach.

- Web push came to iOS/iPadOS 16.4 **only for Home Screen web apps**. A plain Safari tab can't subscribe ([WebKit, Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); [Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers): "Add web push to Home Screen web apps in iOS 16.4 or later and Webpages in Safari 16 for macOS 13 or later").
- The person has to install the site first through Share → "Add to Home Screen". From iOS 16.4, third-party browsers such as Chrome and Firefox on iOS can also offer "Add to Home Screen" ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Push still only works in the installed web app, never in the browser tab.
- Before iOS 26, the site needed a Web App Manifest with `display: standalone` (or `fullscreen`) to open as a web app. From Safari 26 / iOS 26, every site added to the Home Screen opens as a web app by default ([WebKit, News from WWDC25: Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)). A manifest is still worth shipping for name, icons and `id`. The `id` lets iOS sync Focus settings across devices ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- Once installed and allowed, notifications behave like native ones. They show on the Lock Screen, in Notification Center and on a paired Apple Watch, and they follow Focus. The Badging API (`setAppBadge`) also works ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); [Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).
- From iOS/iPadOS 18.4, Safari also supports **Declarative Web Push**. The push payload itself describes the notification in a standard JSON format. No service worker is needed, so a failed script can't get the subscription revoked. The format is backwards compatible: older browsers still handle the same JSON in a service worker ([WebKit, Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)).

**What this means for reach:** an iPhone or iPad user gets nothing from web push until they find "Add to Home Screen", install Cadence, open it from the Home Screen and grant permission there. Cadence would have to teach people how to install it (an in-app "Install Cadence for notifications" step). Most iPhone users won't do that unprompted.

## 4. What a service worker needs under React Router

Cadence is React Router 8 in framework mode with SSR on (`react-router.config.ts`: `ssr: true`), built with Vite (`vite.config.ts`).

- **Secure context.** Service workers only run over HTTPS. `http://localhost` counts as secure, so local dev works ([MDN, Service Worker API](https://github.com/mdn/content/blob/main/files/en-us/web/api/service_worker_api/index.md)).
- **Scope.** The default scope is the directory the worker script is served from. A broader scope needs the `Service-Worker-Allowed` header ([MDN, ServiceWorkerContainer.register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)). So the worker should be served from the site root, e.g. `/sw.js`.
- **Where the file lives.** Vite serves files in `public/` at the root path `/`, unhashed, in dev, and copies them unchanged into the build output ([Vite, The public directory](https://vite.dev/guide/assets#the-public-directory)). A hand-written `public/sw.js` therefore ends up at `/sw.js` with root scope. No plugin is needed. Cadence already has a `public/` folder (`favicon.svg`, `images/`). A plugin such as vite-plugin-pwa is only worth adding if we also want offline caching, which isn't in scope.
- **Registering it.** `navigator.serviceWorker` exists only in the browser. Registration must not run during SSR, so it goes in a `useEffect` (for example in `app/root.tsx`). "Effects only run on the client. They don't run during server rendering." ([React, useEffect](https://react.dev/reference/react/useEffect)).
- **Subscribing.** Call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` from a click handler (see §5). Send the subscription (endpoint + keys) to the server, or to the vendor, and store it against the person. MDN warns that the endpoint is a secret capability URL and that subscription endpoints need CSRF protection ([MDN, Push API](https://github.com/mdn/content/blob/main/files/en-us/web/api/push_api/index.md)).
- **Handlers in `sw.js`.** You need a `push` handler that **always** calls `showNotification`, and a `notificationclick` handler that opens or focuses the right URL. You also need `pushsubscriptionchange` to re-sync when the browser refreshes or revokes a subscription ([MDN, pushsubscriptionchange](https://github.com/mdn/content/blob/main/files/en-us/web/api/serviceworkerglobalscope/pushsubscriptionchange_event/index.md)). If the payload uses the Declarative Web Push JSON format, Safari 18.4+ can show it even if the worker fails ([WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/)).
- **Manifest (for iOS installs).** Add a `manifest.webmanifest` in `public/` with `name`, `icons`, `id`, `start_url` and `display: "standalone"`, and link it from `root.tsx` ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

A hosted notification vendor can take over the server side: VAPID keys, encryption, sending, and pruning dead subscriptions. Cadence still owns `sw.js`, the manifest and the permission UX, because those are served from Cadence's origin.

## 5. Permission prompt rules and good practice

**Hard rules from browsers:**

- **User gesture required.** Firefox 72+ rejects `Notification.requestPermission()` and `PushManager.subscribe()` immediately unless they're called from a user gesture ([Mozilla Hacks, Notification permission changes in Firefox 72](https://hacks.mozilla.org/2019/11/upcoming-notification-permission-changes-in-firefox-72/)). Safari and iOS have the same requirement: "call the push subscription method immediately from the gesture's event handler" ([Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers); [WebKit 16.4](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **No silent push.** `userVisibleOnly: true` is required. If a push doesn't produce a visible notification, Safari revokes the subscription ([WebKit, Meet Web Push](https://webkit.org/blog/12945/meet-web-push/); [Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).
- **Chrome's quieter prompt UI.** Since Chrome 80, Chrome replaces the normal prompt with a quieter one for users who usually block, and for sites with very low opt-in rates ([Chromium Blog](https://blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html)). Prompting badly therefore hurts future prompts too.
- **Chrome auto-revokes permission** for sites with very low engagement and a high notification volume, on Android and desktop. Installed web apps are exempt ([Google, Reducing notification overload in Chrome, Oct 2025](https://blog.google/chromium/automatic-notification-permission/)).
- **Chrome rate limits.** From January 2026, Chrome rate-limits the Push API for sites that send many pushes with little engagement. Over the limit, sends get HTTP 429, with penalties of 1, 7 and then 14 days ([Chrome for Developers, Web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits)). Low-volume, relevant Notifications like Cadence's shouldn't be affected.

**Good practice** ([web.dev, Permission UX](https://web.dev/articles/push-notifications-permissions-ux)):

- Never prompt when the page loads.
- Ask when the value is obvious. For Cadence, that could be right after a Student submits a Refund Request ("Tell me when it's decided?"), or when a Platform Admin opens the Refund Request queue.
- Use the "double permission" pattern: show Cadence's own explanatory UI first, and trigger the browser prompt only on a "yes". A browser "Block" is close to permanent, so this keeps it for people who really don't want push.
- Put an enable/disable switch in settings. That fits the per category × Channel preferences on the map.
- Watch `navigator.permissions.query({name: "notifications"})` for changes ([Mozilla Hacks](https://hacks.mozilla.org/2019/11/upcoming-notification-permission-changes-in-firefox-72/)).

## 6. How reliable delivery is

- **Best effort, bounded by TTL.** The sender must set `TTL`. A push service "MAY retain a push message for a shorter duration than requested" and may "expire the message prior to its advertised Time-To-Live". A device that is offline past the TTL never gets the message ([RFC 8030 §5.2, §7.2](https://www.rfc-editor.org/rfc/rfc8030)). APNs keeps undelivered web pushes for at most 30 days and limits how many it keeps per offline device ([Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).
- **Subscriptions die silently.** "A push service MAY expire a subscription at any time". After that, sends return 404, or 410 on APNs ([RFC 8030 §7.3](https://www.rfc-editor.org/rfc/rfc8030); [Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)). Browsers may also refresh or revoke subscriptions on their own ([MDN, pushsubscriptionchange](https://github.com/mdn/content/blob/main/files/en-us/web/api/serviceworkerglobalscope/pushsubscriptionchange_event/index.md)). Safari's tracking prevention (ITP) deletes service worker registrations for sites people haven't visited in a while, which breaks classic push subscriptions ([WebKit, Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)).
- **Per device, per browser.** A subscription belongs to one service worker in one browser profile on one device ([MDN, Push API](https://github.com/mdn/content/blob/main/files/en-us/web/api/push_api/index.md)). One person has several, and the ones that never got subscribed receive nothing.
- **Desktop needs the browser running** (except Safari on macOS). See §2.
- **Urgency.** A sender can set `Urgency` to `very-low` through `high`. Only `high` asks for immediate delivery over saving device power ([Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).
- **Permission erosion.** Permission can be revoked automatically (Chrome low-engagement revocation) or after a script bug (Safari's silent-push penalty). See §5.

In short, a push is a timely nudge when it gets through. It is not a guaranteed record. Anything that must reach a person also has to live somewhere durable, such as the Notification Feed or email.

## 7. Reach by role

| Role | Typical context (assumed) | Web push reach |
| --- | --- | --- |
| **Student** | Mixed. Much course-watching is on phones and tablets. | Good on desktop and Android. On iPhone/iPad only after an install, so in practice weak for that group. |
| **Instructor** | Mostly desktop, building and managing courses. | Good, while the browser is running. |
| **Team Admin** | A Student who buys Team Licences, often at work on desktop. | Good on desktop; Seat events are low urgency anyway. |
| **Platform Admin** | Cadence staff on desktop, deciding Refund Requests. | Good. Staff can be told to allow notifications and install the web app. |

## 8. Web push vs email as the second Channel

| | Web push | Email |
| --- | --- | --- |
| Opt-in needed | Yes. A browser prompt per browser per device, which can be blocked or auto-revoked. | No. Every account already has an address. |
| iPhone/iPad | Only after "Add to Home Screen" (iOS 16.4+) | Works everywhere |
| Desktop closed browser | Not delivered until the browser runs (except Safari macOS) | Lands in the inbox regardless |
| Durability | Ephemeral. TTL-bounded, subscriptions expire silently. | Persistent record, searchable later |
| Timeliness when it works | Immediate, OS-level, on Lock Screen | Minutes; competes with the inbox |
| Build cost in Cadence | `sw.js`, manifest, permission UX, subscription sync, install guidance for iOS | Cadence already sends refund emails (Postmark today) |

## Conclusion

**Web push is technically credible, but it isn't a credible replacement for email as Cadence's second Channel. Email should be the second Channel. Web push is at most an optional, opt-in extra later.**

- Web push reaches all modern desktop browsers and Android well. That covers most Instructors, Team Admins and Platform Admins.
- On iPhone and iPad it reaches only people who install Cadence to the Home Screen and then allow notifications. Without a native app, that group will be small, and it's the group most likely to be Students on phones.
- Every person has to opt in per browser per device, behind a user-gesture prompt. Browsers penalise careless prompting with quieter UI and auto-revocation.
- Delivery is best effort. TTLs, silent subscription expiry, Safari's ITP and closed desktop browsers all drop messages without telling the sender.
- Email reaches every role by default, needs no install or permission, keeps a durable record, and is already in Cadence's stack.

If web push is added later, it should be:

- opt-in from a settings toggle or a moment of clear value, using the double-permission pattern;
- served as a root-scoped `public/sw.js` registered in a client-only effect, with a manifest for iOS installs and payloads in the Declarative Web Push JSON format;
- treated as a nudge that duplicates a Notification already in the Notification Feed, never as the only place a Notification lives.
