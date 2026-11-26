# Cloud Run backend

## Build and start

Deploy the repository root as a Cloud Run source service with the Node.js 24
buildpack. `project.toml` selects Node.js 24, Bun for dependency installation,
and only the `build` package script during image creation. The repository's
`bun.lock` is retained as the dependency lockfile. The build creates the Vite
frontend in `dist/` and bundles the Express entry point as `dist/server.js`.
Cloud Run starts the service with the existing package `start` script:
`node dist/server.js`.

The Express server already listens on Cloud Run's injected `PORT` and on
`0.0.0.0`. Cloud Run supplies `PORT`; do not set it manually.

## Runtime configuration

Set these non-secret runtime variables:

- `NODE_ENV`
- `FIREBASE_PROJECT_ID`
- `RENTFLOW_DATABASE_TARGET` (must select `supabase-test-runtime`)
- `SUPABASE_TEST_CA_CERT` (absolute path to the mounted TEST CA certificate)
- `ALLOWED_ORIGINS` (the exact browser origins allowed to call the API)

Cloud Run's runtime service account is the Firebase Admin credential source
through Application Default Credentials. Set `FIREBASE_PROJECT_ID` and attach
the intended Cloud Run service identity. Do not configure service-account JSON,
`FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_CLIENT_EMAIL`, or
`FIREBASE_PRIVATE_KEY` for this deployment.

## Secret Manager

- Bind `SUPABASE_TEST_RUNTIME_DATABASE_URL` from a Secret Manager secret as a
  runtime environment variable. It must contain the dedicated Supabase TEST
  runtime-role connection string.
- Mount the Supabase TEST CA certificate from Secret Manager as a read-only
  file, then set `SUPABASE_TEST_CA_CERT` to that mounted file's absolute path.
- Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor`
  on only the secrets it needs.

The application requires the explicit TEST target and dedicated runtime URL;
it does not fall back to `DATABASE_URL`. Do not configure a Neon URL, a
privileged migration URL, `SUPABASE_TEST_DATABASE_URL`, or a legacy database
target for this service. No database migration is part of deployment.

`GEMINI_API_KEY` is optional and is needed only for server-side Gemini features;
if enabled, provide it through Secret Manager. No secret values belong in this
file or in source-controlled deployment configuration.
