# Threat Model

## Project Overview

Area 862 System is a unified Express + React/Vite application for logistics, dispatch, route planning, delivery evidence capture, and customer messaging automation. It serves browser clients and Capacitor-based mobile apps from a single Node.js server, stores business data in PostgreSQL through Sequelize, and integrates with external services including Respond.io, OpenAI, Google Maps/Geocoding, and Gmail.

Primary users are admins/dispatchers, drivers, and regular authenticated users. Production-relevant code lives mainly under `src/` (API, services, models) and `client/` (browser/mobile client). The app stores customer contact data, delivery addresses, delivery evidence, route history, and third-party integration secrets.

Assumptions for future scans:
- Only production-reachable issues should be reported.
- `NODE_ENV` is `production` in deployed environments.
- Replit deployment provides TLS in transit.
- Mockup/sandbox-only code is out of scope unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — user records, password hashes, bearer tokens, and session cookies. Compromise enables impersonation of admins or drivers.
- **Operational delivery data** — routes, stops, customer names, phone numbers, delivery addresses, billing/collection details, and route history. This is both business-sensitive and personal data.
- **Delivery evidence** — uploaded photos and related metadata. Exposure may leak customer identity, addresses, or payment evidence.
- **Messaging and CRM data** — conversation logs, contact identifiers, bot memory, AI learning profiles, and Respond.io-linked order state. Exposure reveals customer communications and internal workflows.
- **Application and integration secrets** — Respond.io tokens, OpenAI keys, Gmail OAuth credentials, webhook secrets, Google API credentials, and database/session secrets. Compromise enables third-party account takeover or data exfiltration.
- **Admin capabilities** — user management, dispatch reset actions, logs, archives, and configuration endpoints. Abuse can alter business operations or destroy evidence.

## Trust Boundaries

- **Client / Server boundary** — browsers and mobile apps send fully untrusted input to the Express API. Every API route must authenticate and authorize server-side.
- **Authenticated / Privileged boundary** — admins, drivers, and regular users have materially different permissions. Role checks must be enforced on every privileged action.
- **Server / Database boundary** — API and background services can read and mutate operational data directly in PostgreSQL. Broken authorization or unsafe queries here expose broad data sets.
- **Server / Filesystem boundary** — uploaded evidence, archives, and logs are stored on disk and some are served back over HTTP. File paths, filenames, and static serving decisions are security-sensitive.
- **Server / External service boundary** — Respond.io, OpenAI, Gmail, and Google APIs are called with privileged credentials. Any route that reads or changes those settings can affect external systems and customer data.
- **Public / Authenticated boundary** — public routes include auth endpoints, health checks, and static `/uploads` file serving; everything else should default to authenticated access, with admin-only restrictions where applicable.
- **Internal background jobs / request boundary** — polling and learning services act with stored tokens and elevated access outside a direct user request. They must preserve tenant boundaries and avoid leaking secrets or PII into logs.

## Scan Anchors

- **Production entry points:** `src/index.js`, `src/routes/*.js`, `src/middleware/auth.js`, `src/services/*.js`, `client/api.js`, `client/contexts/AuthContext.jsx`.
- **Highest-risk areas:** auth/session handling, messaging settings and bot routes, dispatch/admin routes, file upload and public static file serving under `/uploads`, email/Gmail integration routes, and third-party integration services.
- **Privilege boundaries:** public auth routes under `/api/auth/*`, health checks under `/api/health`, public static files under `/uploads`, authenticated routes across most `/api/*`, explicit admin surfaces under `/api/admin/*`, and driver-only behavior mostly enforced inside `src/routes/dispatch.js`.
- **Usually dev-only / lower-priority areas:** `.replit`, `INSTALL.md`, `attached_assets/`, `android/`, `ios/`, and build tooling unless they materially affect production runtime or leak live credentials.

## Threat Categories

### Spoofing

The application supports both session-based authentication and bearer-token authentication. The system must ensure session cookies and long-lived bearer tokens cannot be forged, replayed indefinitely, or stolen from insecure client storage. Any endpoint that accepts either session or bearer auth must resolve identity consistently and reject invalid or expired credentials.

### Tampering

Authenticated users can modify routes, stops, dispatch state, messaging settings, AI behavior, and external CRM-linked order data. The system must enforce object-level and role-based authorization on every mutation so regular users cannot alter other users' operational data or system-wide integration settings. File uploads must accept only intended content and must not allow users to tamper with arbitrary stored assets.

### Information Disclosure

The application processes customer addresses, phone numbers, message history, delivery evidence, and third-party tokens. The system must prevent cross-tenant reads, restrict log visibility, avoid leaking secrets through APIs or console output, and ensure uploaded evidence is not exposed beyond intended audiences. Sensitive client-side credentials must not be stored in ways that allow trivial recovery.

### Denial of Service

Public auth endpoints, upload endpoints, message-processing routes, and external API workflows can all consume CPU, storage, or paid third-party quota. The system must bound request size and expensive work, validate uploaded file size and type, and avoid unauthenticated or low-privilege paths that can trigger costly background processing against external services.

### Elevation of Privilege

This project has clear admin, driver, and regular-user roles, plus background services that act with stored integration tokens. The system must guarantee that only admins can manage users, logs, and global operations; only assigned drivers can complete delivery actions for their routes; and only the owning tenant can read or modify tenant-scoped messaging, CRM, and AI-learning data. Any route that falls back to global settings or omits ownership checks risks privilege escalation across the entire deployment.
