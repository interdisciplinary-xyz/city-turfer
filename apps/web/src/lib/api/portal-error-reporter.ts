// The portal's error reporter, configured from the build's environment. Literal `process.env.*`
// reads, so Next inlines them into the portal's chunks at build time (static export: nothing is
// read at run time). Unset DSN, a preview or a local build: reporting is off.
import { WEB_VERSION } from './client';
import { createErrorReporter, reportingConfig } from './error-reports';
import { connectSentry } from './sentry-reporter';

export const portalErrorReporter = createErrorReporter({
  config: reportingConfig({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    commitSha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    version: WEB_VERSION,
  }),
  connect: connectSentry,
});
