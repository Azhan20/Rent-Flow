import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarDays,
  formatInstantInTimeZone,
  getCalendarDateInTimeZone,
  isValidDateRange,
  parseDateTimeLocalInTimeZone,
} from './dateTime';

test('calendar-date defaults use the organization zone and do not drift at UTC midnight', () => {
  const instant = new Date('2026-11-20T20:30:00.000Z');
  assert.equal(getCalendarDateInTimeZone('Asia/Karachi', instant), '2026-11-21');
  assert.equal(addCalendarDays('2026-11-21', 1), '2026-11-22');
  assert.equal(addCalendarDays('2024-02-28', 1), '2024-02-29');
});

test('date ranges reject invalid dates and require a return date after pickup', () => {
  assert.equal(isValidDateRange('2026-11-21', '2026-11-22'), true);
  assert.equal(isValidDateRange('2026-11-21', '2026-11-21'), false);
  assert.equal(isValidDateRange('2026-02-30', '2026-03-01'), false);
  assert.equal(isValidDateRange('', '2026-03-01'), false);
});

test('organization-local rental times are stored as the corresponding UTC instants', () => {
  assert.equal(
    parseDateTimeLocalInTimeZone('2026-11-21T12:30', 'Asia/Karachi').toISOString(),
    '2026-11-21T07:30:00.000Z',
  );
  assert.match(formatInstantInTimeZone('2026-11-21T07:30:00.000Z', 'Asia/Karachi'), /21 Nov 2026/);
});

test('daylight-saving gaps are rejected and repeated local times resolve consistently', () => {
  assert.throws(
    () => parseDateTimeLocalInTimeZone('2026-03-08T02:30', 'America/New_York'),
    /clock changes/,
  );
  assert.equal(
    parseDateTimeLocalInTimeZone('2026-11-01T01:30', 'America/New_York').toISOString(),
    '2026-11-01T05:30:00.000Z',
  );
});
