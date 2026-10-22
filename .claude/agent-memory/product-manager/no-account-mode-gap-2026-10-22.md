---
name: no-account-mode-gap-2026-10-22
description:
  On scope/v0.9.0 a stranger cannot use the app without an e-mail-code server account, despite
  founder decision B1; "no account needed" copy is false
metadata:
  type: project
---

Found 2026-10-22 during the /branding product-truth review: `apps/mobile/src/app/_layout.tsx` gates
every screen behind sign-in; `sign-in.tsx` only offers the shared `admin`/`demo` password profiles
or an e-mailed code that creates a server account. Founder decision B1
(`docs/plans/backend-plan-2026-10-22.md`) says "using the app without an account stays a full mode".

**Why:** the brand promise ("no account", A5) and the ICP's "What puts them off: a login wall" both
depend on a real no-account entry. Launch-readiness #2 (remove the mock login) is still open.

**How to apply:** before approving any copy with "no account needed", re-check the sign-in screen.
Recommended to the main session: label it a gap, not a claim; founder decides whether a "Use without
an account" local profile ships in v0.9.0. Related: [[backend-recommendation-2026-10-22]].
