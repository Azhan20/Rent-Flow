import test from 'node:test';
import assert from 'node:assert/strict';
import { DATABASE_READINESS_QUERY, probeDatabaseReadiness } from './readiness';

test('readiness executes only the fixed SELECT 1 probe', async () => {
  const statements: string[] = [];
  await probeDatabaseReadiness(async (statement) => { statements.push(statement); });
  assert.deepEqual(statements, [DATABASE_READINESS_QUERY]);
  assert.equal(DATABASE_READINESS_QUERY, 'SELECT 1');
});

test('readiness propagates query failure for the HTTP route to handle safely', async () => {
  await assert.rejects(
    probeDatabaseReadiness(async () => { throw Object.assign(new Error('private'), { code: '08006' }); }),
    /private/,
  );
});
