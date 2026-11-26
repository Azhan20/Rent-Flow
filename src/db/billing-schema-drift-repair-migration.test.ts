import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migration = readFileSync(resolve(projectRoot, 'drizzle/0005_reconcile_billing_schema_drift.sql'), 'utf8');
const journal = JSON.parse(readFileSync(resolve(projectRoot, 'drizzle/meta/_journal.json'), 'utf8')) as {
  entries: Array<{ idx: number; when: number; tag: string; breakpoints: boolean }>;
};

test('billing drift repair is appended after all four journaled migrations', () => {
  assert.deepEqual(journal.entries.slice(-1)[0], {
    idx: 4,
    version: '7',
    when: 1795464746000,
    tag: '0005_reconcile_billing_schema_drift',
    breakpoints: true,
  });
  assert.deepEqual(journal.entries.map((entry) => entry.idx), [0, 1, 2, 3, 4]);
  assert.ok(journal.entries.every((entry, index, entries) => index === 0 || entry.when > entries[index - 1].when));
});

test('migration repairs only the confirmed subscription status and payment verification drift', () => {
  assert.match(migration, /rf_account_subscriptions_status_ck/);
  assert.match(migration, /'SUSPENDED'/);
  assert.match(migration, /payment_method_verified_at timestamptz/);
  assert.match(migration, /rf_account_subscriptions_trial_payment_method_ck/);
  assert.match(migration, /status <> 'TRIALING' OR payment_method_verified_at IS NOT NULL/);
  assert.match(migration, /Existing trial subscription lacks verified payment evidence/);
  assert.match(migration, /Unexpected rf_account_subscriptions_status_ck definition/);
  assert.match(migration, /Unexpected dependent object references subscription status constraint/);
  assert.match(migration, /Unexpected additional status-related CHECK constraint; refusing billing repair/);
  assert.match(migration, /Unexpected additional status-related CHECK constraint remains after billing repair/);
});

test('status guard permits only the status-list and trial-payment checks', () => {
  const allowed = new Set([
    'rf_account_subscriptions_status_ck',
    'rf_account_subscriptions_trial_payment_method_ck',
  ]);
  const hasUnexpectedStatusCheck = (constraints: Array<{ name: string; definition: string }>) =>
    constraints.some(({ name, definition }) => /status/i.test(definition) && !allowed.has(name));

  const observedBeforeRepair = [
    { name: 'rf_account_subscriptions_status_ck', definition: "CHECK (status IN ('PENDING','EXPIRED'))" },
  ];
  const expectedAfterRepair = [
    { name: 'rf_account_subscriptions_status_ck', definition: "CHECK (status IN ('PENDING','SUSPENDED','EXPIRED'))" },
    { name: 'rf_account_subscriptions_trial_payment_method_ck', definition: "CHECK (status <> 'TRIALING' OR payment_method_verified_at IS NOT NULL)" },
  ];
  const unexpectedExtra = [
    ...expectedAfterRepair,
    { name: 'rf_account_subscriptions_no_suspended_ck', definition: "CHECK (status <> 'SUSPENDED')" },
  ];

  assert.equal(hasUnexpectedStatusCheck(observedBeforeRepair), false);
  assert.equal(hasUnexpectedStatusCheck(expectedAfterRepair), false);
  assert.equal(hasUnexpectedStatusCheck(unexpectedExtra), true);
  assert.match(migration, /position\('status' IN lower\(pg_catalog\.pg_get_constraintdef\(con\.oid, true\)\)\) > 0[\s\S]*?con\.conname NOT IN \([\s\S]*?'rf_account_subscriptions_status_ck'[\s\S]*?'rf_account_subscriptions_trial_payment_method_ck'/);
  assert.match(migration, /CHECK \(status IN \('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED'\)\)/);
});

test('migration recreates the Drizzle lifecycle-event schema and append-only guard', () => {
  for (const required of [
    'CREATE TABLE IF NOT EXISTS public.rf_account_subscription_events',
    'id uuid PRIMARY KEY DEFAULT gen_random_uuid()',
    'account_subscription_id uuid NOT NULL',
    'rf_account_subscription_events_subscription_id_rf_account_subscriptions_id_fk',
    'REFERENCES public.rf_account_subscriptions(id) ON DELETE RESTRICT',
    "payment_provider text NOT NULL DEFAULT 'PADDLE'",
    'provider_event_id text',
    'event_type text NOT NULL',
    'occurred_at timestamptz NOT NULL',
    'previous_status text',
    'status text NOT NULL',
    'previous_period_starts_at timestamptz',
    'previous_period_ends_at timestamptz',
    'period_starts_at timestamptz',
    'period_ends_at timestamptz',
    'created_at timestamptz NOT NULL DEFAULT now()',
    'rf_account_subscription_events_provider_ck',
    'rf_account_subscription_events_event_type_ck',
    'rf_account_subscription_events_provider_event_id_ck',
    'rf_account_subscription_events_previous_status_ck',
    'rf_account_subscription_events_status_ck',
    'rf_account_subscription_events_previous_period_ck',
    'rf_account_subscription_events_period_ck',
    'rf_account_subscription_events_provider_event_uq',
    'rf_account_subscription_events_subscription_occurred_idx',
    'rf_reject_account_subscription_event_mutation',
    'rf_account_subscription_events_append_only',
    "USING ERRCODE = '55000'",
    'Lifecycle event table columns differ from the Drizzle schema',
    'Lifecycle event table constraints differ from the Drizzle schema',
    'Lifecycle event indexes differ from the Drizzle schema',
  ]) {
    assert.ok(migration.includes(required), `expected migration to contain ${required}`);
  }
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS rf_account_subscription_events_provider_event_uq[\s\S]*?WHERE provider_event_id IS NOT NULL/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.rf_account_subscription_events/);
  assert.match(migration, /t\.tgtype = 27 AND t\.tgenabled = 'O'/);
  assert.match(migration, /trigger_count <> 1/);
  assert.match(migration, /pg_catalog\.pg_get_triggerdef\(t\.oid, true\)/);
  assert.match(migration, /regexp_replace\(trigger_definition[\s\S]*?expected_trigger_definition/);
  assert.match(migration, /p\.provolatile = 'v'[\s\S]*?NOT p\.proisstrict[\s\S]*?NOT p\.proleakproof[\s\S]*?p\.proparallel = 'u'[\s\S]*?p\.proconfig IS NULL[\s\S]*?p\.prokind = 'f'/);
});

test('trigger guards reject additional, disabled, and incorrectly defined triggers', () => {
  type TriggerState = { name: string; enabled: string; definition: string; functionMatches: boolean };
  const expectedDefinition = 'create trigger rf_account_subscription_events_append_only before update or delete on public.rf_account_subscription_events for each row execute function public.rf_reject_account_subscription_event_mutation()';
  const valid = (triggers: TriggerState[]) => triggers.length === 1
    && triggers[0].name === 'rf_account_subscription_events_append_only'
    && triggers[0].enabled === 'O'
    && triggers[0].definition.replace(/\s+/g, '').toLowerCase() === expectedDefinition.replace(/\s+/g, '').toLowerCase()
    && triggers[0].functionMatches;
  const expected: TriggerState = {
    name: 'rf_account_subscription_events_append_only',
    enabled: 'O',
    definition: 'CREATE TRIGGER rf_account_subscription_events_append_only BEFORE UPDATE OR DELETE ON public.rf_account_subscription_events FOR EACH ROW EXECUTE FUNCTION public.rf_reject_account_subscription_event_mutation()',
    functionMatches: true,
  };

  assert.equal(valid([expected]), true);
  assert.equal(valid([expected, { ...expected, name: 'unexpected_trigger' }]), false);
  assert.equal(valid([{ ...expected, enabled: 'D' }]), false);
  assert.equal(valid([{ ...expected, definition: 'CREATE TRIGGER lifecycle AFTER UPDATE ON public.rf_account_subscription_events FOR EACH ROW EXECUTE FUNCTION public.other_function()' }]), false);
  assert.equal(valid([{ ...expected, functionMatches: false }]), false);
  assert.match(migration, /Unexpected additional lifecycle-event trigger; refusing billing repair/);
  assert.match(migration, /Unexpected, disabled, or incorrectly defined lifecycle append-only trigger; refusing billing repair/);
});

test('trigger definition comparison accepts only optional public qualification on the exact relation and function', () => {
  const expected = 'CREATE TRIGGER rf_account_subscription_events_append_only BEFORE UPDATE OR DELETE ON public.rf_account_subscription_events FOR EACH ROW EXECUTE FUNCTION public.rf_reject_account_subscription_event_mutation()';
  const normalizeAllowedQualification = (definition: string) => definition
    .replace(/public\.(rf_account_subscription_events|rf_reject_account_subscription_event_mutation)/g, '$1')
    .replace(/\s+/g, '')
    .toLowerCase();
  const matches = (definition: string) => normalizeAllowedQualification(definition) === normalizeAllowedQualification(expected);

  assert.equal(matches(expected), true);
  assert.equal(matches('CREATE TRIGGER rf_account_subscription_events_append_only BEFORE UPDATE OR DELETE ON rf_account_subscription_events FOR EACH ROW EXECUTE FUNCTION rf_reject_account_subscription_event_mutation()'), true);
  assert.equal(matches('CREATE TRIGGER rf_account_subscription_events_append_only BEFORE UPDATE OR DELETE ON public.other_events FOR EACH ROW EXECUTE FUNCTION public.rf_reject_account_subscription_event_mutation()'), false);
  assert.equal(matches('CREATE TRIGGER rf_account_subscription_events_append_only BEFORE UPDATE OR DELETE ON public.rf_account_subscription_events FOR EACH ROW EXECUTE FUNCTION public.other_function()'), false);

  assert.match(migration, /regexp_replace\(trigger_definition,[\s\S]*?public\\\.\(rf_account_subscription_events\|rf_reject_account_subscription_event_mutation\)/);
  assert.match(migration, /t\.tgfoid = expected_function AND t\.tgtype = 27 AND t\.tgenabled = 'O'/);
});

test('lifecycle foreign key checks exact relation and columns independent of qualification in rendered definitions', () => {
  type ForeignKey = {
    localColumn: string;
    referencedRelationOid: number;
    expectedRelationOid: number;
    referencedColumn: string;
    deleteAction: string;
    type: string;
    validated: boolean;
  };
  const catalogMatches = (fk: ForeignKey) => fk.localColumn === 'account_subscription_id'
    && fk.referencedRelationOid === fk.expectedRelationOid
    && fk.referencedColumn === 'id'
    && fk.deleteAction === 'r'
    && fk.type === 'f'
    && fk.validated;
  const valid: ForeignKey = {
    localColumn: 'account_subscription_id',
    referencedRelationOid: 42,
    expectedRelationOid: 42,
    referencedColumn: 'id',
    deleteAction: 'r',
    type: 'f',
    validated: true,
  };

  // Both deparser spellings represent the same public relation; the migration
  // validates the catalog OID/columns/action rather than comparing that text.
  const qualified = 'FOREIGN KEY (account_subscription_id) REFERENCES public.rf_account_subscriptions(id) ON DELETE RESTRICT';
  const unqualified = 'FOREIGN KEY (account_subscription_id) REFERENCES rf_account_subscriptions(id) ON DELETE RESTRICT';
  const acceptsEquivalentDefinition = (definition: string, fk: ForeignKey) =>
    /^FOREIGN KEY \(account_subscription_id\) REFERENCES (?:public\.)?rf_account_subscriptions\(id\) ON DELETE RESTRICT$/i.test(definition)
    && catalogMatches(fk);
  assert.equal(acceptsEquivalentDefinition(qualified, valid), true);
  assert.equal(acceptsEquivalentDefinition(unqualified, valid), true);
  assert.equal(acceptsEquivalentDefinition('FOREIGN KEY (account_subscription_id) REFERENCES public.other_subscriptions(id) ON DELETE RESTRICT', valid), false);
  assert.equal(acceptsEquivalentDefinition(qualified, { ...valid, referencedRelationOid: 99 }), false);
  assert.equal(acceptsEquivalentDefinition(qualified, { ...valid, deleteAction: 'a' }), false);
  assert.equal(acceptsEquivalentDefinition(qualified, { ...valid, referencedColumn: 'billing_account_id' }), false);

  assert.match(migration, /con\.confrelid = 'public\.rf_account_subscriptions'::regclass/);
  assert.match(migration, /con\.conkey = ARRAY\[local_column\.attnum\]::smallint\[\]/);
  assert.match(migration, /con\.confkey = ARRAY\[referenced_column\.attnum\]::smallint\[\]/);
  assert.match(migration, /con\.confdeltype = 'r'/);
  assert.match(migration, /Lifecycle event subscription foreign key differs from the Drizzle schema/);
});

test('migration fails closed on unexpected schema and never renames existing billing foreign keys', () => {
  assert.match(migration, /Expected public\.rf_account_subscriptions table; refusing billing repair/);
  assert.match(migration, /Unexpected payment_method_verified_at definition; refusing billing repair/);
  assert.match(migration, /Unexpected append-only trigger function definition or attributes; refusing billing repair/);
  assert.match(migration, /ALTER TABLE public\.rf_account_subscriptions DROP CONSTRAINT rf_account_subscriptions_status_ck/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|\bTRUNCATE\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bGRANT\b|\bREVOKE\b/i);
  assert.doesNotMatch(migration, /ALTER TABLE public\.rf_(billing_accounts|billing_account_organizations|account_subscriptions|billing_trial_history|billing_usage|billing_account_entitlement|account_subscription_changes)\s+RENAME CONSTRAINT/i);
});
