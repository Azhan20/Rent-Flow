import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  resolveProjectRootFromConfigUrl,
  validateTestingDatabaseTarget,
} from './drizzle-config-validation';

const validEnvironment = {
  DATABASE_URL:
    'postgresql://testing-user:synthetic-password@ep-floral-dawn-be6dbzbp-pooler.c-9.us-east-2.aws.neon.tech:5432/neondb?sslmode=require',
  DATABASE_SSL: 'true',
};

test('resolves the project .env path from the config URL, independent of the shell directory', () => {
  const configProjectRoot = resolve(tmpdir(), 'rentflow-config-root-check');
  const configUrl = pathToFileURL(
    resolve(configProjectRoot, 'src', 'db', 'drizzle.config.ts'),
  ).href;
  const envPath = resolve(resolveProjectRootFromConfigUrl(configUrl), '.env');

  assert.equal(envPath, resolve(configProjectRoot, '.env'));
  assert.notEqual(envPath, resolve(process.cwd(), '.env'));
});

test('accepts only the confirmed rentflow-testing hostname and enables full TLS verification', () => {
  const target = validateTestingDatabaseTarget(validEnvironment);

  assert.equal(target.host, 'ep-floral-dawn-be6dbzbp-pooler.c-9.us-east-2.aws.neon.tech');
  assert.equal(target.database, 'neondb');
  assert.equal(target.ssl, 'verify-full');
  assert.equal(target.port, 5432);
});

test('rejects production, unknown, and non-exact hostnames without echoing the URL', () => {
  const unapprovedHosts = [
    'ep-bold-cloud-beiraa7e-pooler.c-9.us-east-2.aws.neon.tech',
    'ep-unknown-branch-12345678-pooler.c-9.us-east-2.aws.neon.tech',
    'ep-floral-dawn-be6dbzbp-pooler.c-9.us-east-2.aws.neon.tech.attacker.example',
    'ep-proud-field-belh2xjm.c-9.us-east-2.aws.neon.tech',
    'ep-rentflow-production.c-9.us-east-2.aws.neon.tech',
    'production.example.net',
  ];

  for (const hostname of unapprovedHosts) {
    const unapprovedUrl = `postgresql://testing-user:synthetic-password@${hostname}:5432/neondb`;

    assert.throws(
      () => validateTestingDatabaseTarget({ ...validEnvironment, DATABASE_URL: unapprovedUrl }),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.match(error.message, /approved testing database hostname/);
        assert.equal(error.message.includes('synthetic-password'), false);
        assert.equal(error.message.includes(unapprovedUrl), false);
        return true;
      },
    );
  }
});

test('requires SSL to be explicitly enabled', () => {
  for (const sslValue of ['false', undefined]) {
    assert.throws(
      () => validateTestingDatabaseTarget({ ...validEnvironment, DATABASE_SSL: sslValue }),
      /DATABASE_SSL must equal "true"/,
    );
  }
});

test('requires the configured database name', () => {
  assert.throws(
    () =>
      validateTestingDatabaseTarget({
        ...validEnvironment,
        DATABASE_URL: validEnvironment.DATABASE_URL.replace('/neondb?', '/postgres?'),
      }),
    /must select the neondb testing database/,
  );
});

test('requires DATABASE_URL', () => {
  assert.throws(
    () => validateTestingDatabaseTarget({ DATABASE_SSL: 'true' }),
    /DATABASE_URL is required/,
  );
});

test('rejects malformed PostgreSQL URLs without exposing their contents', () => {
  const malformedUrl = 'postgresql://synthetic-user:synthetic-password@[';

  assert.throws(
    () => validateTestingDatabaseTarget({ ...validEnvironment, DATABASE_URL: malformedUrl }),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /valid PostgreSQL URL/);
      assert.equal(error.message.includes('synthetic-user'), false);
      assert.equal(error.message.includes('synthetic-password'), false);
      assert.equal(error.message.includes(malformedUrl), false);
      return true;
    },
  );
});
