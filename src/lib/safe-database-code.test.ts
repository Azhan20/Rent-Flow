import test from 'node:test';
import assert from 'node:assert/strict';
import { safeDatabaseCode, safeDatabaseErrorClass } from './safe-database-code';

test('returns only a five-character PostgreSQL SQLSTATE', () => {
  assert.equal(safeDatabaseCode({ code: '42501' }), '42501');
  assert.equal(safeDatabaseCode({ code: '08006' }), '08006');
});

test('does not pass through arbitrary or malformed error codes', () => {
  assert.equal(safeDatabaseCode({ code: 'password=hidden' }), undefined);
  assert.equal(safeDatabaseCode({ code: 'ECONNREFUSED' }), undefined);
  assert.equal(safeDatabaseCode({ code: 42501 }), undefined);
  assert.equal(safeDatabaseCode(null), undefined);
});

test('extracts a SQLSTATE only from a bounded wrapped cause chain', () => {
  assert.equal(safeDatabaseCode({ name: 'DrizzleQueryError', cause: { code: '42501', message: 'hidden' } }), '42501');
  const cyclic: { cause?: unknown; code?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(safeDatabaseCode(cyclic), undefined);
});

test('classifies database failures using only safe SQLSTATE categories', () => {
  assert.equal(safeDatabaseErrorClass({ cause: { code: '08006' } }), 'database_connection');
  assert.equal(safeDatabaseErrorClass({ cause: { code: '28P01' } }), 'database_authentication');
  assert.equal(safeDatabaseErrorClass({ cause: { code: '42501' } }), 'database_permission_or_rls');
  assert.equal(safeDatabaseErrorClass({ cause: { code: '23505' } }), 'database_constraint');
  assert.equal(safeDatabaseErrorClass({ cause: { code: '42703' } }), 'database_query_or_schema');
  assert.equal(safeDatabaseErrorClass({ cause: { code: 'ECONNRESET' } }), 'database_connection');
  assert.equal(safeDatabaseErrorClass({ cause: { code: 'password=hidden' } }), 'unclassified');
});
