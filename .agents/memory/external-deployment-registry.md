---
name: External deployment dependency registry
description: Dependency lockfiles shared with non-Replit servers must not retain Replit's private npm registry URLs.
---

Keep `package-lock.json` install URLs public when the same repository is deployed outside Replit, and make direct dependencies compatible with the Node version used by that server.

**Why:** Replit can generate lockfiles whose tarball URLs point to `package-firewall.replit.internal`; external hosts cannot resolve that hostname, so `npm install` fails and required imports are missing at runtime.

**How to apply:** After changing dependencies, search the lockfile for `package-firewall.replit.internal` and verify the production Node engine before restarting the external process.