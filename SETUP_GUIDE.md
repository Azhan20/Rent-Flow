# RentFlow local setup and deployment

## Current readiness

Firebase account flows, verified user synchronization, organization creation, memberships, and authenticated AI requests are wired. The production workspace has PostgreSQL backed equipment/customer create and list screens plus rental request creation with server calculated rates and row-locked availability checks. A production user is not shown the seeded demo workspace. Do not use this build as a complete rental platform or to activate subscriptions: several workflows and all verification remain incomplete.

## Runtime and package manager

The project uses Bun 1.4.4 and `bun.lock`. TypeScript check, production frontend/backend build, and 31 local tests passed in the development working copy on 2026-11-13. These local tests do not replace database, Firebase emulator, or live deployment tests. `@grpc/grpc-js` resolves to 1.14.7 in the installed dependency tree. Do not create an npm or pnpm lockfile alongside `bun.lock`.

```powershell
bun install --frozen-lockfile
Copy-Item .env.example .env
bun run dev
```

The development server uses Vite middleware on the Express server. The production build creates the static frontend and a bundled Node server in `dist/server.js`:

```powershell
bun run build
bun run start
```

## Firebase Authentication

1. Create or select a Firebase project and register a Web App.
2. Put the Web App's `apiKey`, `authDomain`, `projectId`, and `appId` into the matching `VITE_FIREBASE_*` variables. These values are delivered to browsers; restrict the API key to the correct APIs and authorized referrers.
3. Enable Email/Password in Firebase Authentication. Enable Google only if the business wants it and configure its OAuth consent and support email. Turn on Firebase email-enumeration protection in the project.
4. Add local and production hostnames under Firebase Authentication → Settings → Authorized domains.
5. Configure the backend with `FIREBASE_PROJECT_ID`. For production use the hosting platform's workload identity / Application Default Credentials. For local use, either set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`, or provide `FIREBASE_SERVICE_ACCOUNT_JSON` through a local secret store. Never commit service account material.
6. Email verification is required before protected app content is rendered. Passwords remain with Firebase; no password hashes are stored by this app.

## PostgreSQL and Drizzle

Provide a private `DATABASE_URL`. Runtime production database access requires `DATABASE_SSL=true`, and TLS certificate verification remains enabled. The runtime does not fall back to a local/default database. Drizzle is the intended canonical ORM; legacy Prisma model history is retained only for migration reference and is not used by runtime code. `bun run db:migrate:testing` is guarded for the dedicated RentFlow testing Neon project below; the config requires its approved testing hostname, the `neondb` database, and `DATABASE_SSL=true` with certificate verification enabled. Its runner redacts database credentials and PostgreSQL URLs from Drizzle Kit output while preserving diagnostic messages and the command's exit status. Use this package command only; invoking Drizzle Kit directly bypasses the output redaction wrapper. Never use this command for production or another database target.

Verified testing target metadata: project `RentFlow-Clean-Testing-2026` (`still-dawn-81716518`), created `2026-11-13T21:25:44Z`; default branch `production` (`br-snowy-glade-beaet68w`); database `neondb` (ID `530571`); endpoint hostname `ep-proud-field-belh2xjm.c-9.us-east-2.aws.neon.tech`. The guarded migration allowlist accepts this exact hostname. Neon metadata did not identify a parent branch or establish the data's origin or row contents, so do not assume the database is empty or disposable.

The new `rf_*` tables are designed to be additive so the legacy tables are left intact. The SQL migration and `src/db/schema.ts` have been statically reviewed for matching tables, columns, constraints, foreign keys, and indexes. No migration has been run against a database in this workspace. Organization-scoped APIs use membership queries and tenant-scoped foreign keys; PostgreSQL RLS is not enabled.

## Isolated security integration testing

This working copy currently has no configured `DATABASE_URL` or `TEST_DATABASE_URL`, disposable PostgreSQL instance, Docker, PostgreSQL command-line/server tools, Firebase CLI, Java runtime, or running Firebase Authentication Emulator. Cross-tenant database tests and Firebase emulator tests have therefore not run. Do not point tests or migrations at an unverified `.env` or shared database.

The guarded migration command is limited to the verified RentFlow testing Neon project and accepts only the approved testing hostname and `neondb`; the former production-derived testing hostname and production hosts are rejected. It is not a generic command for other disposable databases. Verify the branch and database target before using it, and keep test credentials private. Do not copy production credentials into the test shell.

Run the Firebase Authentication Emulator with a dedicated non-production project ID, test-only users, and matching client/server project IDs. The browser client does not currently connect to the Auth Emulator; add that explicit development-only connection before expecting browser authentication flows to use it. Never enable emulator settings in a production build.

RLS remains disabled. Current organization list queries and user synchronization include direct reads/writes through the shared Drizzle pool outside a tenant-scoped transaction, and the runtime/migration database roles have not been verified. Enabling RLS safely requires all tenant-owned operations to run in transactions that set a transaction-local tenant context only after server-side identity and membership checks, plus a non-bypass runtime role. Local `SET` state on pooled connections must not be used. The testing project is a separate Neon project, but its data origin and row contents are unverified: use a reviewed forward corrective migration and a verified restore plan for rollback. Never drop or reset the branch/database as a rollback step without independent data verification and explicit approval.

## Gemini

Set `GEMINI_API_KEY` as a server-only secret. Requests require a Firebase ID token and a verified email. If the key is absent the API returns `503 AI_NOT_CONFIGURED`; it does not manufacture a successful answer. AI quotas/credit accounting and organization-sourced context are not implemented yet.

## Firebase App Check

App Check is not connected to the browser or Express API yet. There is no App Check site key in the template and no server verification middleware. Enable it in Firebase Console only after the client provider and backend token verification are implemented and verified in monitoring mode; it must not replace Firebase Authentication or organization membership checks.

## Payments and subscriptions

No payment provider is selected or configured. Plan cards preserve a plan identifier through signup, but selection does not activate a trial or paid subscription. Do not add active entitlements manually; implement signed, idempotent provider webhooks after choosing a provider.

## Production hosting checklist

- Set `NODE_ENV=production`, `PORT`, and an explicit comma-separated `ALLOWED_ORIGINS` list.
- Supply Firebase Admin credentials through workload identity or the platform secret manager; provide the public Firebase Web App settings as build-time `VITE_*` variables.
- Supply `DATABASE_URL` and require TLS (`DATABASE_SSL=true`). Use separate least-privilege runtime and migration database roles.
- Supply `GEMINI_API_KEY` only to the backend when enabling AI.
- Build with `bun run build` and start with `bun run start`; serve the `dist` SPA and API behind HTTPS.
- Configure Firebase authorized domains and restrict any browser Maps API key by host and API.
- Confirm backups, restore procedures, migration review, monitoring, rate limits, and secret rotation before onboarding real businesses.
- Do not deploy until missing update/delete and rental lifecycle APIs, database migration verification, authorization and concurrency tests, operational workflows, and production browser verification are complete.

## Backup and recovery

Use managed PostgreSQL point-in-time recovery plus scheduled encrypted logical backups. Keep backups in a separate account/region with controlled access and retention. Periodically restore a backup into a disposable database, verify row counts and representative rental records, then record the restore result. This repository does not configure a backup service.
