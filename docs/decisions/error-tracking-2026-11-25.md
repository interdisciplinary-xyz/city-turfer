---
status: proposed
verified: 2026-11-25
owner: founder
scope:
  [
    apps/mobile/src/ui-kit/use-async-action.ts,
    apps/mobile/src/ui-kit/classify-error.ts,
    apps/mobile/src/ui-kit/toast-provider.tsx,
    apps/mobile/src/platform/error-reporter.ts,
    apps/mobile/src/platform/crash-reporting.ts,
    apps/mobile/src/platform/sentry-error-reporter.ts,
    packages/ui/src/toast,
    packages/core/src/error-scrub,
    apps/api/src/app.ts,
    apps/api/src/sentry.ts,
    apps/web/src/lib/api/error-reports.ts,
    apps/web/src/lib/api/sentry-reporter.ts,
    apps/web/src/lib/api/query-client.ts,
    tools/audit-logs.mjs,
  ]
summary:
  Error tracking and the async request rule — every user action shows loading, a success or error
  message, and reports only unexpected errors to Sentry (EU, scrubbed, opt-out in the app); the API
  catches once in onError; public website pages load no Sentry
---

# Error tracking and the async request rule

## What the founder asked (2026-11-25)

> Please make sure our agents know that this is how all future async requests should be defined:
> try: set isLoading to true, show success toast message if done correctly / catch: report error to
> sentry, show error toast message / finally: turn off isLoading. On server side: try: do the work /
> catch: report error to Sentry, return a proper error message.

Before this, each screen handled its own failures: some swallowed them, some showed a raw message,
none reported them, so a bug in the field was invisible until a tester mentioned it.

## Decision: the narrowed rule

The founder chose the narrowed reading of the request:

1. **Loading** on while the work runs, off in every case (`finally`).
2. **Success toast** only for a mutation the user started whose result the screen does not show by
   itself (deleting an activity leaves the screen; a backup finishing in a card does not). No toast
   for reads, map loads, Route Planner taps or background work.
3. **Error message** for every failure the user started: the specific message when there is one, "No
   connection" when offline, else a generic one. A form that shows its error inline shows no toast.
4. **Report only the unexpected.** Offline, an API 4xx answer, a `DomainError`, a denied permission,
   the router's budget and a failure the call site states (`ExpectedFailure`) are the world, not
   bugs: worded, never reported. Everything else is reported once.
5. **Server side:** the handler does the work and throws; one catch (`app.onError`) answers an
   expected refusal with its problem+json and turns anything else into `500 internal` plus one
   report.

Why narrowed: a toast on every success trains people to ignore toasts, and reporting expected
failures buries the real bugs under offline noise and spends the error budget on nothing.

## Where it lives

| Surface | The rule in code                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App     | `useAsyncAction` (`apps/mobile/src/ui-kit/use-async-action.ts`) for every action the Turfer starts; `classifyError` (`classify-error.ts`) decides expected or not; the toast host `toast-provider.tsx` in the root layout draws `Toast` from `packages/ui/src/toast`. Background work reports through the `ErrorReporter` port (`apps/mobile/src/platform/error-reporter.ts`); `crash-reporting.ts` starts Sentry (`sentry-error-reporter.ts`) lazily. |
| API     | `app.onError` in `apps/api/src/app.ts`; reports through `deps.reportError` (`apps/api/src/sentry.ts`, `@sentry/core` server client). Runbook: `docs/operations/api-deploy.md`, "Error reports".                                                                                                                                                                                                                                                        |
| Portal  | The query client (`apps/web/src/lib/api/query-client.ts`) offers every failed query and mutation to `portalErrorReporter`; `isUnexpected` in `error-reports.ts` keeps 5xx answers and non-API errors; the account `error.tsx` reports render crashes. The SDK loads only through `sentry-reporter.ts`, on portal pages.                                                                                                                                |
| Website | Public pages: no Sentry at all (`apps/web/tools/check-export.mjs` fails an export that mentions it; dependency-cruiser keeps `@sentry/*` in the portal's adapter). The waitlist form keeps its own states.                                                                                                                                                                                                                                             |

Builders find the pattern in the `add-feature` skill ("Async requests"), with the surface details in
the `api-design`, `web-portal`, `design-system` and `mobile-i18n` skills; `mobile-reviewer` checks
it.

## Privacy

- **EU region.** All three surfaces report to Sentry's EU (Frankfurt) region. All three refuse a DSN
  outside `*.ingest.de.sentry.io` (the app in `isEuDsn`,
  `apps/mobile/src/platform/sentry-error-reporter.ts`).
- **Production only, errors only.** API and portal report only on Vercel production; the app never
  in development builds, tests or without `EXPO_PUBLIC_SENTRY_DSN`. No tracing, replay, profiling or
  user identifier on any surface.
- **Scrubbed.** Every event and breadcrumb passes `scrubEvent` / `scrubBreadcrumb` from
  `@cityturfer/core/error-scrub` (`packages/core/src/error-scrub`): no request, user or extra data,
  coordinate-looking numbers redacted, URLs without query, `health-sync` reports reduced to the
  error's name and code. The API never sends the error message; the portal adds an e-mail pass. No
  coordinates, Apple Health data or e-mail in a report, by rule and by gate: `pnpm run audit:logs`
  fails a report call (`.report(`, `reportError(`, `captureException(`…) whose arguments name a
  coordinate word, in `apps/mobile/src`, `apps/api/src` and `apps/web/src`.
- **Opt-out in the app.** "Send crash reports" in Info is on by default and turns reporting off on
  that device (`SecureStoreCrashReportSetting`, read before the SDK starts). The portal and the API
  have no switch: they report only server-side failures and portal bugs, with no personal data.
- **IP addresses** are not sent by any SDK. **Founder to-do:** in the Sentry project settings turn
  on "Prevent Storing of IP Addresses" and the data scrubbers for every project (API runbook,
  `docs/operations/api-deploy.md`, step 2), and sign Sentry's DPA.

Details per surface: `docs/operations/observability.md` §1a.

## Not done

- The portal's privacy copy on crash reports is `portal.privacy.stored.crashReports`; the App Store
  privacy answers were not checked against it.
- No closed tag set across surfaces (observability §4 is still a proposal).
- Sentry projects, DSNs and the IP setting are not created or set by any code: founder steps.
- Alerting (who is told when a new issue appears) is not set up.
