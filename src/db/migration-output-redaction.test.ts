import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectDatabaseSecrets,
  redactMigrationOutput,
} from './migration-output-redaction';

test('redacts PostgreSQL URLs and credential values while preserving the database error', () => {
  const username = 'synthetic-test-user';
  const password = 'synthetic-test-password';
  const connectionUrl =
    'postgresql://synthetic-test-user:synthetic-test-password@testing.example:5432/neondb';
  const output = `Error: password authentication failed for user "${username}"; ${connectionUrl}`;

  const redacted = redactMigrationOutput(output, [username, password, connectionUrl]);

  assert.match(redacted, /password authentication failed for user/);
  assert.equal(redacted.includes(username), false);
  assert.equal(redacted.includes(password), false);
  assert.equal(redacted.includes(connectionUrl), false);
  assert.equal(redacted.includes('postgresql://'), false);
});

test('redacts URL and credential fields even when only the output contains them', () => {
  const output =
    'DATABASE_URL="postgres://other-user:other-password@db.example/neondb" user: other-user password=other-password';

  const redacted = redactMigrationOutput(output, ['other-user', 'other-password']);

  assert.equal(redacted.includes('other-user'), false);
  assert.equal(redacted.includes('other-password'), false);
  assert.equal(redacted.includes('postgres://'), false);
  assert.match(redacted, /DATABASE_URL=\[REDACTED DATABASE URL\]/);
});

test('redacts percent-encoded credentials in either percent-escape case', () => {
  const username = 'renter/user';
  const password = 'secret:pass';
  const connectionUrl = 'postgresql://renter%2fuser:secret%3apass@testing.example/neondb';
  const secrets = collectDatabaseSecrets(connectionUrl, { user: username, password });
  const output = 'user=renter%2Fuser password=secret%3Apass';

  const redacted = redactMigrationOutput(output, secrets);

  assert.equal(redacted.includes('renter%2Fuser'), false);
  assert.equal(redacted.includes('secret%3Apass'), false);
  assert.match(redacted, /user=\[REDACTED\] password=\[REDACTED\]/);
});

test('redacts malformed PostgreSQL URL fields without echoing their contents', () => {
  const malformedUrl = 'postgresql://synthetic-user:synthetic-password@[';
  const output = `DATABASE_URL="${malformedUrl}"`;

  const redacted = redactMigrationOutput(output, [
    malformedUrl,
    'synthetic-user',
    'synthetic-password',
  ]);

  assert.equal(redacted.includes('synthetic-user'), false);
  assert.equal(redacted.includes('synthetic-password'), false);
  assert.equal(redacted.includes('postgresql://'), false);
  assert.match(redacted, /DATABASE_URL=\[REDACTED DATABASE URL\]/);
});

test('leaves non-secret diagnostic details intact', () => {
  const output = 'Error: relation "equipment" does not exist (SQLSTATE 42P01)';

  assert.equal(redactMigrationOutput(output, ['synthetic-password']), output);
});
