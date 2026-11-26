import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createApplicationPoolOptions,
} from './postgres-config';
import {
  SUPABASE_TEST_RUNTIME_LOGIN,
  validateSupabaseTestRuntimeDatabaseTarget,
} from './supabase-testing-config-validation';

const runtimeUrl = `postgresql://${SUPABASE_TEST_RUNTIME_LOGIN}:synthetic-password@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`;

test('Supabase TEST runtime selection fails closed without its own URL despite other database URLs', () => {
  assert.throws(() => createApplicationPoolOptions({
    RENTFLOW_DATABASE_TARGET: 'supabase-test-runtime',
    DATABASE_URL: 'postgresql://legacy-user:synthetic-password@legacy.example:5432/legacy',
    SUPABASE_TEST_DATABASE_URL: 'postgresql://admin-user:synthetic-password@admin.example:5432/postgres',
    SUPABASE_TEST_CA_CERT: 'C:\\test-ca.pem',
  }), /SUPABASE_TEST_RUNTIME_DATABASE_URL is required/);
});

test('application requires an explicit database target and does not infer one from available URLs', () => {
  assert.throws(() => createApplicationPoolOptions({
    DATABASE_URL: 'postgresql://legacy-user:synthetic-password@legacy.example:5432/legacy',
  }), /RENTFLOW_DATABASE_TARGET must explicitly select/);
});

test('runtime target accepts only the approved runtime login, endpoint, port, and database', () => {
  const wrongRuntimeUsers = [
    runtimeUrl.replace(SUPABASE_TEST_RUNTIME_LOGIN, 'postgres.dgasadodjzpjofkvjkbw'),
    runtimeUrl.replace(SUPABASE_TEST_RUNTIME_LOGIN, 'rentflow_runtime.dgasadodjzpjofkvjkbw'),
  ];
  for (const url of wrongRuntimeUsers) {
    assert.throws(() => validateSupabaseTestRuntimeDatabaseTarget({
      SUPABASE_TEST_RUNTIME_DATABASE_URL: url,
      SUPABASE_TEST_CA_CERT: 'C:\\test-ca.pem',
    }, process.cwd()), /approved Supabase TEST runtime login/);
  }

  for (const url of [
    runtimeUrl.replace(':5432/', ':6543/'),
    runtimeUrl.replace('/postgres', '/otherdb'),
    runtimeUrl.replace('aws-1-ap-northeast-1.pooler.supabase.com', 'unapproved.example'),
  ]) {
    assert.throws(() => validateSupabaseTestRuntimeDatabaseTarget({
      SUPABASE_TEST_RUNTIME_DATABASE_URL: url,
      SUPABASE_TEST_CA_CERT: 'C:\\test-ca.pem',
    }, process.cwd()));
  }
});

test('runtime target rejects missing CA and caller-forged target objects', () => {
  assert.throws(() => validateSupabaseTestRuntimeDatabaseTarget({
    SUPABASE_TEST_RUNTIME_DATABASE_URL: runtimeUrl,
  }, process.cwd()), /SUPABASE_TEST_CA_CERT must be an absolute path/);

  const forgedTarget = {
    host: 'forged.example', port: 6543, user: 'forged', password: 'synthetic-password', database: 'other',
    ssl: { rejectUnauthorized: false, servername: 'forged.example' },
  };
  assert.throws(() => createApplicationPoolOptions({
    RENTFLOW_DATABASE_TARGET: 'supabase-test-runtime',
    target: forgedTarget,
  } as never), /SUPABASE_TEST_RUNTIME_DATABASE_URL is required/);
  const source = readFileSync(resolve(process.cwd(), 'src/db/postgres-config.ts'), 'utf8');
  assert.doesNotMatch(source, /export\s+function\s+createSupabaseTestRuntimePoolOptions/);
});

test('runtime URL cannot forge host, port, database, login, CA, or TLS verification', () => {
  for (const url of [
    runtimeUrl.replace(SUPABASE_TEST_RUNTIME_LOGIN, 'forged-user'),
    runtimeUrl.replace('aws-1-ap-northeast-1.pooler.supabase.com', 'forged.example'),
    runtimeUrl.replace(':5432/', ':6543/'),
    runtimeUrl.replace('/postgres', '/forged-db'),
  ]) {
    assert.throws(() => createApplicationPoolOptions({
      RENTFLOW_DATABASE_TARGET: 'supabase-test-runtime',
      SUPABASE_TEST_RUNTIME_DATABASE_URL: url,
      SUPABASE_TEST_CA_CERT: 'C:\\test-ca.pem',
    }));
  }

  assert.throws(() => createApplicationPoolOptions({
    RENTFLOW_DATABASE_TARGET: 'supabase-test-runtime',
    SUPABASE_TEST_RUNTIME_DATABASE_URL: runtimeUrl,
    SUPABASE_TEST_CA_CERT: 'relative-ca.pem',
  }), /SUPABASE_TEST_CA_CERT must be an absolute path/);

  const validation = readFileSync(resolve(process.cwd(), 'src/db/supabase-testing-config-validation.ts'), 'utf8');
  assert.match(validation, /parsedUrl\.hostname !== SUPABASE_TEST_POOLER_HOST/);
  assert.match(validation, /port !== SUPABASE_TEST_POOLER_PORT/);
  assert.match(validation, /parsedUrl\.pathname !==/);
  assert.match(validation, /user !== expectedUser \|\| !password/);
  assert.match(validation, /!certificate\.ca[\s\S]*?validToDate\.getTime\(\) <= now/);
  assert.match(validation, /rejectUnauthorized: true,[\s\S]*?servername: SUPABASE_TEST_POOLER_HOST/);
});

test('legacy DATABASE_URL is used only when legacy target is explicitly selected', () => {
  const options = createApplicationPoolOptions({
    RENTFLOW_DATABASE_TARGET: 'legacy',
    DATABASE_URL: 'postgresql://legacy-user:synthetic-password@legacy.example:5432/legacy',
    DATABASE_SSL: 'true',
  });
  assert.equal(options.user, 'legacy-user');
  assert.equal(options.host, 'legacy.example');
});
