# Which hosted notification vendor fits Cadence?

Research for [issue #2](https://github.com/ian0/cohort-005-project/issues/2), part of the map [Notifications in Cadence](https://github.com/ian0/cohort-005-project/issues/1).

Sources are the vendors' own pricing pages and documentation, read in November 2026. Every claim links to the page it came from. Pricing and plan gating change often, so check the linked page again before signing up.

## What Cadence needs

From the map: one hosted vendor (no self-hosting) whose free tier works in development. It must offer:

- a headless API for the **Notification Feed**, with live updates, so we build the UI ourselves;
- feed authentication with a per-person token that our server signs;
- preferences per Notification category × **Channel**, stored by the vendor;
- a second Channel, which is web push or email. Cadence already sends refund email through Postmark.

## Summary table

| | Knock | Novu Cloud | Courier | MagicBell | SuprSend |
|---|---|---|---|---|---|
| Free tier | 10k messages/mo, unlimited workflows, preferences included | 10k workflow runs/mo, **max 5 workflows**, 24h activity log | 10k sends/mo, Test env sends count | **1k deliveries/mo, 1 project** | 10k notifications/mo, **preferences gated to Business ($250/mo)** after 30-day trial |
| Signed feed token | RS256 JWT you sign locally (`sub`, `exp`), "enhanced security mode" | HMAC-SHA256 of subscriberId, **no expiry** | JWT **minted by Courier API call**, scoped, expiring | HS256 JWT you sign locally | ES256 JWT you sign locally (`entity_id`, `exp`), "enhanced security mode" |
| Headless feed + real-time | REST feed API + WebSocket; headless React hooks / JS client | `@novu/js` / `@novu/react` hooks, WebSocket | `courier-js`, real-time over the JWT session | `magicbell-js` user client + `Realtime` WebSocket | headless React hooks / JS SDK, socket |
| Category × Channel prefs | Yes: `categories.<cat>.channel_types` | Per **workflow** × channel (+ global); no first-class category | Yes: topics with per-channel `custom_routing` | Yes: `categories[].channels[]` | Yes: categories + channel within category (paid) |
| Web push | Via FCM only (no first-party web push) | Via FCM / OneSignal / Pushpad / Pusher Beams / webhook | Via FCM / OneSignal / Pusher Beams / MagicBell | **Native VAPID** | **Native VAPID** |
| Postmark as email provider | Yes, native | Yes, native | Yes, native | No native; only through generic SMTP | Yes, native |
| Local dev / testing | Dev + prod envs, per-channel **sandbox mode**, `sandbox_mode` on trigger, built-in test email channel | Dev + prod envs, `npx novu dev` local Studio (Framework) | Test env with test email provider, draft keys; no sandbox mode | Separate project per env (free tier = 1 project) | Sandbox / Staging / Production workspaces |

## Knock

**Free tier.** $0/month, "up to 10,000" messages sent. A message is "a single message delivered to a single user on a single channel", so one in-feed item plus one email is two messages. You aren't charged when preferences suppress a message. The free tier has unlimited workflows, delivery channels and isolated environments. Preferences, the feed API, prebuilt and bring-your-own components, and end-to-end testing are all included. The free tier gates Knock-branding removal, email client previews and per-tenant features. Knock does not hard-cap the free tier when you go over. Source: [knock.app/pricing](https://knock.app/pricing).

**Signed feed token.** By default the browser calls Knock with a public API key. Knock recommends turning on **enhanced security mode** in production. Then every client request must also carry "a signed user token that identifies the user". Your backend signs a JWT with the private signing key from the dashboard, using **RS256**. The token must contain `sub` (the user id), and Knock recommends `iat` and `exp`. The Node SDK ships `signUserToken` with a default expiry of 3600s. The client gets an `onUserTokenExpiring` callback for refresh, and the token can carry `grants` that restrict which resources it can reach. Enhanced security is off by default, so development can start without it. Source: [Security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication.md).

**Headless feed and real-time.** The in-app APIs fetch a user's feed, return badge counts (unread/unseen), and mark messages seen/read/archived. A WebSocket emits `new-message` events for real-time delivery. Feed items carry `data`, rendered `blocks`, `source.categories` and timestamps, and the feed can be filtered by `data`. Source: [In-app APIs and real-time service](https://docs.knock.app/in-app-ui/api-overview.md). For custom UI, Knock has React headless hooks and a low-level client ([llms.txt index: "React Headless UI" and "Custom UI (headless)"](https://docs.knock.app/llms.txt)).

**Preferences.** Each user has a `PreferenceSet` with `categories`, `channels`, `channel_types` and `workflows` keys. You get a category × channel grid by nesting `channel_types` (e.g. `email`, `in_app_feed`, `push`) under each category. A workflow can belong to several categories. Users can read and update their own preferences from the client, through the public-key endpoints. Sources: [Preferences overview](https://docs.knock.app/preferences/overview.md), [public API key endpoints](https://docs.knock.app/in-app-ui/security-and-authentication.md).

**Web push.** "Knock does not have a first-party web push channel. Instead, you'll use FCM to send messages to a user's browser". That means the Firebase SDK, a service worker, and the VAPID key taken from Firebase. Source: [Sending web push with FCM](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm.md). The push providers Knock supports are APNs, FCM, Expo, OneSignal and Amazon SNS ([Push overview](https://docs.knock.app/integrations/push/overview.md), [llms.txt](https://docs.knock.app/llms.txt)).

**Email / Postmark.** There is a native Postmark integration, configured per environment. It covers delivery tracking, bounces and **sandbox mode**. Source: [Postmark](https://docs.knock.app/integrations/email/postmark.md). You still pay Postmark separately ([pricing FAQ](https://knock.app/pricing)).

**Local dev and testing.**
- Environments: an account starts with production only. Enabling environments adds development, and you can then create more ([Environments](https://docs.knock.app/version-control/environments.md)).
- **Sandbox mode** "generate[s] and preview[s] messages for a given channel without delivering them". It works for every channel type except in-app, and needs no provider credentials ([Integrations overview: Sandbox mode](https://docs.knock.app/integrations/overview.md)).
- A trigger can force sandbox mode and skip delays through `settings.sandbox_mode` and `settings.skip_delay`, which helps in automated tests ([Testing workflows](https://docs.knock.app/send-notifications/testing-workflows.md)).
- A built-in test email channel sends 100 emails a month, only to account members ([Knock test emails](https://docs.knock.app/integrations/email/knock-test.md)).

## Novu Cloud

**Free tier.** $0/month, 10,000 workflow runs a month, all channels, **up to 5 workflows**, 2 environments (Dev + Prod), 24-hour activity-feed retention and up to 3 team members. Removing Novu branding needs Pro ($30/mo and up). Source: [novu.co/pricing](https://novu.co/pricing).

**Signed feed token.** Novu uses **HMAC**. You turn on "Security HMAC encryption" on the Novu In-App integration. The server then computes `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` and passes it to the client next to the public `applicationIdentifier`. Without it, "a malicious actor could potentially guess another subscriber's `subscriberId`". Source: [Prepare for Production](https://docs.novu.co/platform/inbox/prepare-for-production.md). The hash covers only the subscriberId, so it never expires and can't be scoped. The docs page says nothing about expiry or rotation. That's weaker than a short-lived signed token.

**Headless feed and real-time.** `@novu/react` offers headless hooks (`useNotifications`, `useCounts`, …) "while Novu provides the notification state, real-time updates" ([Headless Mode](https://docs.novu.co/platform/inbox/headless-mode.md)). `@novu/js` exposes WebSocket events such as `notifications.notification_received` and `notifications.unread_count_changed` ([@novu/js](https://docs.novu.co/platform/sdks/javascript.md)).

**Preferences.** There are three levels: workflow channel preferences (defaults), subscriber global preferences, and subscriber channel preferences per workflow. "The most specific layer that defines a channel wins" ([Preferences](https://docs.novu.co/platform/concepts/preferences.md)). Novu has no first-class *category*. The Inbox can only filter or group workflows by **tags** in its preferences UI ([Inbox preferences](https://docs.novu.co/platform/inbox/configuration/preferences.md)). A Notification category would therefore be one workflow, or a set of workflows the client groups, and the free tier allows only 5 workflows.

**Web push.** Novu delivers push through providers only: FCM, APNS, Expo, OneSignal, Pusher Beams, Pushpad, Push Webhook and others. It has no native VAPID sender ([Push](https://docs.novu.co/platform/integrations/push.md), [index](https://docs.novu.co/_llms/notify.txt)).

**Email / Postmark.** There is a native Postmark provider that uses your Postmark Server API token ([Postmark](https://docs.novu.co/platform/integrations/email/postmark.md)).

**Local dev and testing.** Development and Production environments come by default. Custom environments need the Team plan or above ([Environments](https://docs.novu.co/platform/developer/environments.md)). With Novu Framework, `npx novu dev` opens the dashboard in "Local mode", which connects to your running app through a tunnel ([Remix quickstart](https://docs.novu.co/framework/quickstart/remix.md)).

## Courier

**Free tier.** The Developer plan is free and gives 10,000 sends a month. "One send is one template sent to one recipient", whichever channels it goes out on. "Sends from Test and custom environments count the same as Production". The plan includes journeys, broadcasts, SDKs and the CLI, with 30-day log retention. Source: [courier.com/pricing](https://www.courier.com/pricing).

**Signed feed token.** The client SDKs use a JWT, but **Courier issues it, not your server**. Your backend calls `POST /auth/issue-token` with the API key, a scope string (e.g. `user_id:user_123 inbox:read:messages inbox:write:events`) and `expires_in`. It then hands the returned token to the client. Preferences need extra `read:preferences write:preferences` scopes. Source: [Authenticate users with a JWT](https://www.courier.com/docs/in-app/authenticate-users.md). The token is production-grade (scoped, expiring), but minting one costs a network round-trip to Courier on every new session.

**Headless feed and real-time.** Once signed in, the inbox opens a real-time connection, and "the same live feed drives a custom UI" ([Inbox runtime behavior](https://www.courier.com/docs/in-app/how-the-inbox-behaves.md)). You can replace parts of the prebuilt inbox or build your whole UI from the SDK's messages, unread counts and actions ([Build a custom inbox](https://www.courier.com/docs/in-app/build-a-custom-inbox.md)). A browser-only, no-UI SDK is also listed ([Courier JS SDK, llms.txt](https://www.courier.com/docs/llms.txt)).

**Preferences.** Preferences are modelled as **topics** grouped into sections. Each topic has a default state (`OPTED_IN`, `OPTED_OUT`, `REQUIRED`), and a user can pick channels per topic (`custom_routing`: `email`, `inbox`, `push`, …). A template is mapped to a topic so that Courier enforces the preference on every send. Sources: [Preferences model](https://www.courier.com/docs/recipients/preferences/model.md), [Build a preference center](https://www.courier.com/docs/guides/build-a-preference-center.md).

**Web push.** Courier sends push through APNs, FCM, Expo, OneSignal, Airship, SNS, Pusher Beams, Pusher, MagicBell and others. It has no native VAPID sender ([Push providers](https://www.courier.com/docs/integrations/push/overview.md)).

**Email / Postmark.** A native Postmark integration "keep[s] Postmark as your email provider". Postmark bills delivery and Courier bills per send ([Postmark](https://www.courier.com/docs/integrations/email/postmark.md)).

**Local dev and testing.** Production and Test environments come by default. "Courier has no separate test mode: a Test key is what puts you in the Test environment". Draft keys (`dk_`) render unpublished templates. The Test environment ships a testing email provider that "only delivers to the address you signed up with". Source: [Environments and API keys](https://www.courier.com/docs/workspaces/environments.md). Courier documents no sandbox mode that suppresses delivery.

## MagicBell

**Free tier.** The Builder plan is $0/month with **1,000 deliveries a month** and **1 project**. Deliveries are counted per channel: a notification shown in-app and also emailed counts twice. Source: [magicbell.com/pricing](https://www.magicbell.com/pricing). The quick start suggests separate projects for staging and production ([Quick Start](https://www.magicbell.com/docs/quick-start)), but the free tier gives you only one.

**Signed feed token.** The User JWT is "generated on your backend using the Secret Key and the API Key from your project". It is signed **HS256**, and its payload carries `user_external_id` and/or `user_email` plus `api_key`. The examples set `exp` ([User JWT](https://www.magicbell.com/docs/api/authentication/user), [API Authentication](https://www.magicbell.com/docs/api/authentication)).

**Headless feed and real-time.** `magicbell-js` has a user client for the REST API and a `Realtime` client that uses "WebSocket connections" to push new notifications, with automatic reconnection ([Browser/Node Client](https://www.magicbell.com/docs/libraries/magicbell-js)). Prebuilt React, Preact, Svelte and Web Components are also offered ([In-App Channel](https://www.magicbell.com/docs/channels/in_app)).

**Preferences.** `GET/PUT /v2/channels/user_preferences` takes the user JWT. The body shape is `{"categories":[{"key","label","channels":[{"name":"email","enabled":true}]}]}`, which is category × channel ([API reference: User Preferences](https://www.magicbell.com/docs/api/reference)).

**Web push.** This is **native**. You configure the Web Push channel with your own VAPID `public_key` and `private_key`, and each device token is the browser's `PushSubscription` (`endpoint`, `keys`) ([Web Push Channel Provider](https://www.magicbell.com/docs/channels/web_push)).

**Email / Postmark.** The listed email providers are Amazon SES, Mailgun, Ping Email, SMTP and SendGrid. **Postmark is not one of them** ([Email channel / docs nav](https://www.magicbell.com/docs/channels/email)). Postmark does accept SMTP at `smtp.postmarkapp.com` ([Postmark SMTP](https://postmarkapp.com/developer/user-guide/send-email-with-smtp)), so MagicBell's generic SMTP provider ([SMTP](https://www.magicbell.com/docs/channels/email/smtp)) could reach Postmark. You would lose Postmark-specific features such as delivery webhooks.

**Local dev and testing.** The dashboard has a "Create Broadcast" page for testing an inbox ([Quick Start](https://www.magicbell.com/docs/quick-start)). The docs describe no sandbox or test mode, and no separate environments beyond extra projects.

## SuprSend

**Free tier.** $0/month and 10k notifications a month, with unlimited channels and an in-app feed that carries SuprSend branding. "Premium features" unlock for a 30-day trial, after which the account drops to the Free plan. The **User Preferences** feature and category/sub-category preferences belong to the **Business** plan ($250/mo, billed annually). The comparison table marks them as unavailable on Free and Essentials. Source: [suprsend.com/pricing](https://www.suprsend.com/pricing).

**Signed feed token.** It works like Knock's. Turn on "enhanced secure mode" and every client request must carry a signed user JWT. You sign it on the backend with a dashboard signing key, using **ES256**, and the payload is `entity_type: "subscriber"`, `entity_id`, `exp`, `iat` and an optional tenant `scope` ([Client authentication](https://docs.suprsend.com/docs/client-authentication.md)). The React SDK moved from HMAC subscriber auth to JWT ([React inbox overview](https://docs.suprsend.com/docs/react-inbox-integration.md)).

**Headless feed and real-time.** Headless React hooks and providers back a custom feed UI. The SDK reports socket and API reachability, so the UI can tell whether the live feed is up ([Build your own feed UI (headless)](https://docs.suprsend.com/docs/react-sdk-headless-feed.md)).

**Preferences.** Users opt out of categories and choose channels within a category. Evaluation runs User Preference → Tenant Default → Category Default ([User Preferences](https://docs.suprsend.com/docs/user-preferences.md)). This is paid-only, as noted above.

**Web push.** This is **native**. You pass a `vapidKey` from the SuprSend dashboard, serve a `serviceworker.js` that loads SuprSend's worker script, and call `registerPush` ([WebPush (JS)](https://docs.suprsend.com/docs/js-webpush.md)).

**Email / Postmark.** There is a native Postmark vendor integration ([Postmark](https://docs.suprsend.com/docs/postmark.md)).

**Local dev and testing.** Every account gets three workspaces: Sandbox, Staging and Production. The Sandbox workspace has pre-configured vendors and runs for a trial period, delivering email only to verified addresses. Staging is for development ([Workspaces](https://docs.suprsend.com/docs/workspaces.md)).

## Assessment against Cadence's needs

- **Free tier usable in development.** MagicBell's 1,000 deliveries and single project are tight, with no separate dev environment. SuprSend's free tier loses category × channel preferences after the 30-day trial, so the preferences work can't be built or tested on the free tier. Novu's 5-workflow cap is a problem when a Notification category maps to a workflow and the Notification Catalogue covers four roles. Knock and Courier both give 10k a month with preferences included.
- **Production-grade signed tokens.** Knock, SuprSend and MagicBell all use a JWT that our server signs locally with an expiry. That works with today's DevUI identity: sign with the DevUI-selected person's id, needing no network call and fitting tests. Courier's tokens are also proper (scoped, expiring), but we must call Courier to mint each one. Novu's HMAC never expires.
- **Category × Channel preferences stored by the vendor.** Knock, Courier and MagicBell model this directly. SuprSend has it on paid plans only. Novu models workflow × channel.
- **Web push.** Only MagicBell and SuprSend send web push natively with our own VAPID keys. Knock, Novu and Courier need FCM (or OneSignal etc.) in between, which adds a Firebase project.
- **Email via Postmark.** Knock, Novu, Courier and SuprSend integrate with Postmark natively. MagicBell reaches it only through SMTP.
- **Local dev and testing.** Knock is strongest: per-channel and per-trigger sandbox mode that never calls the provider, a dev environment, and a test email channel. Courier has a Test environment that still counts toward billing and has no delivery-suppressing sandbox. Novu has a local Studio. None of the five offers an offline emulator, so tests without the vendor will still need our own fake behind a small interface, like today's `.outbox/` transport.

## Conclusion

**Shortlist: Knock (recommended), Courier (runner-up).**

- **Recommended: Knock.** It is the only candidate that meets every hard requirement on its free tier with nothing gated:
  - 10k messages a month;
  - an RS256 per-person JWT signed locally, with expiry;
  - a headless feed API with a WebSocket;
  - a first-class `categories` × `channel_types` preference set that the vendor stores;
  - native Postmark;
  - the best testing story (sandbox mode, dev environment).

  Its one gap is web push, which needs FCM. That pushes the second-Channel decision toward **email via Postmark**, which Knock supports natively. If web push is chosen anyway, plan for a Firebase project.
- **Runner-up: Courier.** It is also free at 10k a month, with topic × channel preferences, native Postmark and a scoped, expiring JWT. It ranks lower because every token needs a call to Courier, there is no sandbox mode, and Test-environment sends count toward billing.
- **Not shortlisted:**
  - **Novu**: the HMAC never expires, there are no category preferences, and the free tier allows 5 workflows.
  - **MagicBell**: 1k deliveries and one project on free, and Postmark only via SMTP. It does have native VAPID web push.
  - **SuprSend**: category × channel preferences need the $250/mo Business plan after the trial. Its native VAPID web push and ES256 JWT are otherwise strong.
