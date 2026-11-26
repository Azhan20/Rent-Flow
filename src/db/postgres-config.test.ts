import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresPoolOptions } from './postgres-config';

const validUrl = 'postgresql://test-user:synthetic-password@db.example:5432/rentflow';

test('requires TLS to be explicitly enabled in production', () => {
  for (const sslValue of ['false', undefined]) {
    assert.throws(
      () => createPostgresPoolOptions({ NODE_ENV: 'production', DATABASE_URL: validUrl, DATABASE_SSL: sslValue }),
      /DATABASE_SSL must equal "true" in production/,
    );
  }
});

test('parses credentials separately and forces certificate verification when SSL is enabled', () => {
  const options = createPostgresPoolOptions({
    NODE_ENV: 'production',
    DATABASE_URL: `${validUrl}?sslmode=no-verify`,
    DATABASE_SSL: 'true',
  });

  assert.equal(options.host, 'db.example');
  assert.equal(options.user, 'test-user');
  assert.equal(options.password, 'synthetic-password');
  assert.equal(options.database, 'rentflow');
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal('connectionString' in options, false);
});

test('rejects malformed connection URLs without echoing credentials', () => {
  const malformedUrl = 'postgresql://test-user:synthetic-password@[';

  assert.throws(
    () => createPostgresPoolOptions({ DATABASE_URL: malformedUrl }),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /valid PostgreSQL URL/);
      assert.equal(error.message.includes('test-user'), false);
      assert.equal(error.message.includes('synthetic-password'), false);
      assert.equal(error.message.includes(malformedUrl), false);
      return true;
    },
  );
});
