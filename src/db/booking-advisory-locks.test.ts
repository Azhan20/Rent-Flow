import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import dotenv from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireBookingAvailabilityLocks,
  BOOKING_AVAILABILITY_LOCK_NAMESPACE,
  createBookingAvailabilityLockQuery,
  getBookingAvailabilityLockKeys,
  requestedEquipmentIsTenantScoped,
} from './booking-advisory-locks';
import { validateSupabaseTestingDatabaseTarget } from './supabase-testing-config-validation';

const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
dotenv.config({ path: resolve(projectRoot, '.env'), quiet: true });

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherOrganizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const equipmentA = '11111111-1111-4111-8111-111111111111';
const equipmentB = '22222222-2222-4222-8222-222222222222';

test('builds one namespaced lock key for a single-equipment booking', () => {
  assert.deepEqual(getBookingAvailabilityLockKeys(organizationId, [equipmentA]), [
    `${BOOKING_AVAILABILITY_LOCK_NAMESPACE}:${organizationId}:${equipmentA}`,
  ]);
});

test('builds stable lock keys for multiple equipment items regardless of input order', () => {
  const forward = getBookingAvailabilityLockKeys(organizationId, [equipmentB, equipmentA]);
  const reverse = getBookingAvailabilityLockKeys(organizationId, [equipmentA, equipmentB]);

  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward, [...forward].sort());
  assert.equal(forward.length, 2);
});

test('deduplicates equipment UUIDs and normalizes UUID case before locking', () => {
  assert.deepEqual(
    getBookingAvailabilityLockKeys(organizationId.toUpperCase(), [equipmentA, equipmentA.toUpperCase(), equipmentB]),
    getBookingAvailabilityLockKeys(organizationId, [equipmentA, equipmentB]),
  );
});

test('scopes the lock key to both organization and equipment', () => {
  assert.notDeepEqual(
    getBookingAvailabilityLockKeys(organizationId, [equipmentA]),
    getBookingAvailabilityLockKeys(otherOrganizationId, [equipmentA]),
  );
  assert.notDeepEqual(
    getBookingAvailabilityLockKeys(organizationId, [equipmentA]),
    getBookingAvailabilityLockKeys(organizationId, [equipmentB]),
  );
});

test('rejects equipment rows that are missing or belong to another organization', () => {
  assert.equal(requestedEquipmentIsTenantScoped(organizationId, [equipmentA], []), false);
  assert.equal(requestedEquipmentIsTenantScoped(organizationId, [equipmentA], [
    { id: equipmentA, organizationId: otherOrganizationId },
  ]), false);
  assert.equal(requestedEquipmentIsTenantScoped(organizationId, [equipmentA], [
    { id: equipmentA, organizationId },
  ]), true);
});

test('uses parameterized PostgreSQL advisory-lock SQL and acquires keys sequentially in sorted order', async () => {
  const dialect = new PgDialect();
  const executed: Array<{ query: string; params: unknown[] }> = [];
  const events: string[] = [];
  const executor = {
    async execute(query: SQL) {
      const compiled = dialect.sqlToQuery(query);
      executed.push({ query: compiled.sql, params: compiled.params });
      events.push(`lock:${String(compiled.params[0])}`);
    },
  };

  await acquireBookingAvailabilityLocks(executor, organizationId, [equipmentB, equipmentA, equipmentA]);
  events.push('availability-read');

  const expectedKeys = getBookingAvailabilityLockKeys(organizationId, [equipmentA, equipmentB]);
  assert.deepEqual(executed.map((entry) => entry.params[0]), expectedKeys);
  assert.deepEqual(executed.map((entry) => entry.params[1]), [0, 0]);
  assert(executed.every((entry) => entry.query.includes('pg_catalog.pg_advisory_xact_lock')));
  assert(executed.every((entry) => entry.query.includes('pg_catalog.hashtextextended')));
  assert(executed.every((entry) => !entry.query.includes(expectedKeys[0])));
  assert.deepEqual(events, [...expectedKeys.map((key) => `lock:${key}`), 'availability-read']);
});

type TestTarget = ReturnType<typeof validateSupabaseTestingDatabaseTarget>;
let testTarget: TestTarget | null = null;
try {
  testTarget = validateSupabaseTestingDatabaseTarget({
    SUPABASE_TEST_DATABASE_URL: process.env.SUPABASE_TEST_DATABASE_URL,
    SUPABASE_TEST_CA_CERT: process.env.SUPABASE_TEST_CA_CERT,
  }, projectRoot);
} catch {
  // Unit tests still run when the isolated Supabase testing connection is absent.
}

const testPool = testTarget
  ? new Pool({ ...testTarget, max: 4, connectionTimeoutMillis: 3_000, query_timeout: 8_000, statement_timeout: 8_000 })
  : null;
after(async () => { await testPool?.end(); });

function clientExecutor(client: PoolClient) {
  const dialect = new PgDialect();
  return {
    execute(query: SQL) {
      const compiled = dialect.sqlToQuery(query);
      return client.query(compiled.sql, compiled.params);
    },
  };
}

function lockKey(equipmentId: string, orgId = organizationId) {
  return getBookingAvailabilityLockKeys(orgId, [equipmentId])[0];
}

async function begin(client: PoolClient) {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '5s'");
}

async function tryAcquire(client: PoolClient, key: string) {
  const compiled = new PgDialect().sqlToQuery(createBookingAvailabilityLockQuery(key));
  const tryQuery = compiled.sql.replace('pg_advisory_xact_lock', 'pg_try_advisory_xact_lock');
  const result = await client.query(tryQuery, compiled.params);
  return result.rows[0]?.pg_try_advisory_xact_lock === true;
}

test('real PostgreSQL advisory-lock concurrency smoke tests', {
  skip: testTarget ? false : 'SUPABASE_TEST_DATABASE_URL and SUPABASE_TEST_CA_CERT are not configured for the isolated test project',
  timeout: 15_000,
}, async (t) => {
  assert(testPool);
  let probe: PoolClient;
  try {
    probe = await testPool.connect();
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    const message = error instanceof Error ? error.message : '';
    if (['EACCES', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code ?? '') || /connection timeout/i.test(message)) {
      t.skip('Supabase test database is unreachable from this environment; real concurrency smoke tests are pending');
      return;
    }
    throw error;
  }
  let identity;
  try {
    identity = await probe.query('SELECT current_database() AS database, current_user AS role');
  } finally {
    probe.release();
  }
  assert.equal(identity.rows[0]?.database, 'postgres');
  assert.equal(identity.rows[0]?.role, 'postgres');
  assert.equal(testTarget?.user, 'postgres.dgasadodjzpjofkvjkbw');

  await t.test('transaction locks release on commit', async () => {
    const holder = await testPool.connect();
    const observer = await testPool.connect();
    const key = lockKey(equipmentA);
    try {
      await begin(holder); await begin(observer);
      await acquireBookingAvailabilityLocks(clientExecutor(holder), organizationId, [equipmentA]);
      assert.equal(await tryAcquire(observer, key), false);
      await holder.query('COMMIT');
      assert.equal(await tryAcquire(observer, key), true);
      await observer.query('COMMIT');
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await observer.query('ROLLBACK').catch(() => undefined);
      holder.release(); observer.release();
    }
  });

  await t.test('transaction locks release on rollback after a failed booking operation', async () => {
    const holder = await testPool.connect();
    const observer = await testPool.connect();
    const key = lockKey(equipmentA);
    try {
      await begin(holder); await begin(observer);
      await acquireBookingAvailabilityLocks(clientExecutor(holder), organizationId, [equipmentA]);
      await holder.query('ROLLBACK');
      assert.equal(await tryAcquire(observer, key), true);
      await observer.query('COMMIT');
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await observer.query('ROLLBACK').catch(() => undefined);
      holder.release(); observer.release();
    }
  });

  await t.test('concurrent booking attempts for the same equipment serialize', async () => {
    const first = await testPool.connect();
    const second = await testPool.connect();
    const observer = await testPool.connect();
    const key = lockKey(equipmentA);
    try {
      await begin(first); await begin(second); await begin(observer);
      await acquireBookingAvailabilityLocks(clientExecutor(first), organizationId, [equipmentA]);
      let secondAcquired = false;
      const waiting = acquireBookingAvailabilityLocks(clientExecutor(second), organizationId, [equipmentA]).then(() => { secondAcquired = true; });
      await new Promise((resolveWait) => setTimeout(resolveWait, 75));
      assert.equal(secondAcquired, false);
      assert.equal(await tryAcquire(observer, key), false);
      await first.query('COMMIT');
      await waiting;
      assert.equal(await tryAcquire(observer, key), false);
      await second.query('COMMIT');
      assert.equal(await tryAcquire(observer, key), true);
      await observer.query('COMMIT');
    } finally {
      await first.query('ROLLBACK').catch(() => undefined);
      await second.query('ROLLBACK').catch(() => undefined);
      await observer.query('ROLLBACK').catch(() => undefined);
      first.release(); second.release(); observer.release();
    }
  });

  await t.test('concurrent bookings for different equipment do not block each other', async () => {
    const first = await testPool.connect();
    const second = await testPool.connect();
    try {
      await begin(first); await begin(second);
      await acquireBookingAvailabilityLocks(clientExecutor(first), organizationId, [equipmentA]);
      await acquireBookingAvailabilityLocks(clientExecutor(second), organizationId, [equipmentB]);
      await second.query('ROLLBACK');
      await first.query('ROLLBACK');
    } finally {
      await first.query('ROLLBACK').catch(() => undefined);
      await second.query('ROLLBACK').catch(() => undefined);
      first.release(); second.release();
    }
  });
});
