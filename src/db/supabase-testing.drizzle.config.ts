import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { resolveProjectRootFromConfigUrl } from './drizzle-config-validation';
import { validateSupabaseTestingDatabaseTarget } from './supabase-testing-config-validation';

const projectRoot = resolveProjectRootFromConfigUrl(import.meta.url);
dotenv.config({ path: resolve(projectRoot, '.env') });

const target = validateSupabaseTestingDatabaseTarget(
  {
    SUPABASE_TEST_DATABASE_URL: process.env.SUPABASE_TEST_DATABASE_URL,
    SUPABASE_TEST_CA_CERT: process.env.SUPABASE_TEST_CA_CERT,
  },
  projectRoot,
);

export default defineConfig({
  schema: resolve(projectRoot, 'src/db/schema.ts'),
  out: resolve(projectRoot, 'drizzle'),
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: {
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: target.database,
    ssl: target.ssl,
  },
  verbose: false,
});
