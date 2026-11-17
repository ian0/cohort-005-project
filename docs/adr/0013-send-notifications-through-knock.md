# Send Notifications through Knock

Cadence sends every Notification through Knock, a hosted notification vendor. We never self-host one or build our own. Knock was the only vendor that met the whole brief on its free plan (10K messages a month): it requires RS256 signed user tokens, so each person can only read their own Notification Feed, whichever user the DevUI switcher selects. It also stores preferences by category × Channel and has a headless feed API for the Notification Feed we build ourselves. A prototype against the real app passed all four checks before we committed ([Does Knock hold up against Cadence?](https://github.com/ian0/cohort-005-project/issues/18)).

## Considered Options

- **Courier.** The runner-up: scoped JWTs, topic × channel preferences and pay-as-you-go pricing. We'd switch to it if Knock stops working for us.
- **Novu Cloud.** Rejected: its feed auth is a static HMAC with no expiry, and its preferences have no categories.
- **MagicBell.** Rejected: native web push, but only 1K deliveries a month on the free tier.
- **SuprSend.** Rejected: vendor-stored and category preferences need paid plans.

## Consequences

- Notifications, read/seen state and preferences live only in Knock, not in SQLite. Leaving Knock means losing the Notification Feed history and everyone's preferences.
- Email Notifications go out through Knock's email channel, with our existing Postmark account connected as the provider.
- Workflows, email layouts and preference categories are kept as code in `knock/` and pushed with the Knock CLI and a small Management API script, never edited in the dashboard.
- Past 10K messages a month, the next plan costs $250/mo.
