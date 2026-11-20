import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import {
  resolveProjectRootFromConfigUrl,
  validateTestingDatabaseTarget,
} from './drizzle-config-validation';

const projectRoot = resolveProjectRootFromConfigUrl(import.meta.url);
dotenv.config({ path: resolve(projectRoot, '.env') });

const target = validateTestingDatabaseTarget({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL: process.env.DATABASE_SSL,
});

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
