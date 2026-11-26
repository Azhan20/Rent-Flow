export const DEFAULT_RENTAL_TIME_ZONE = 'Asia/Karachi';

type CalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    calendar: 'iso8601',
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

export function getRentalTimeZone(timeZone?: string | null): string {
  if (timeZone) {
    try {
      getDateTimeFormatter(timeZone);
      return timeZone;
    } catch {
      // Invalid or legacy organization time zones use the documented PKT fallback.
    }
  }
  return DEFAULT_RENTAL_TIME_ZONE;
}

function partsAt(instant: number, timeZone: string): CalendarParts {
  const parts = getDateTimeFormatter(timeZone).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function utcFromParts(parts: CalendarParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, 0, 0);
  return date.getTime();
}

function isSameMinute(a: CalendarParts, b: CalendarParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
    && a.hour === b.hour && a.minute === b.minute;
}

function parseCalendarDate(value: string): CalendarParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: 0, minute: 0,
  };
  if (!isSameMinute(partsAt(utcFromParts(parts), 'UTC'), parts)) return null;
  return parts;
}

function parseDateTimeLocal(value: string): CalendarParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]),
  };
  if (parts.hour > 23 || parts.minute > 59) return null;
  if (!isSameMinute(partsAt(utcFromParts(parts), 'UTC'), parts)) return null;
  return parts;
}

export function getCalendarDateInTimeZone(
  timeZone: string = DEFAULT_RENTAL_TIME_ZONE,
  instant: Date = new Date(),
): string {
  const parts = partsAt(instant.getTime(), getRentalTimeZone(timeZone));
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function addCalendarDays(value: string, days: number): string {
  const parts = parseCalendarDate(value);
  if (!parts || !Number.isSafeInteger(days)) throw new RangeError('Provide a valid calendar date and whole number of days.');
  const date = new Date(utcFromParts(parts));
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999) throw new RangeError('The resulting calendar date is out of range.');
  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function isValidDateRange(startDate: string, endDate: string): boolean {
  return parseCalendarDate(startDate) !== null
    && parseCalendarDate(endDate) !== null
    && endDate > startDate;
}

/** Converts an organization-local datetime-local value to a UTC instant. */
export function parseDateTimeLocalInTimeZone(value: string, timeZone: string): Date {
  const localParts = parseDateTimeLocal(value);
  if (!localParts) throw new RangeError('Choose a valid date and time.');

  const safeTimeZone = getRentalTimeZone(timeZone);
  const localAsUtc = utcFromParts(localParts);
  const possibleOffsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = localAsUtc + hours * 60 * 60 * 1000;
    const zonedParts = partsAt(sample, safeTimeZone);
    possibleOffsets.add((utcFromParts(zonedParts) - sample) / (60 * 1000));
  }

  const matchingInstants = [...possibleOffsets]
    .map((offsetMinutes) => localAsUtc - offsetMinutes * 60 * 1000)
    .filter((instant) => isSameMinute(partsAt(instant, safeTimeZone), localParts))
    .sort((a, b) => a - b);

  if (matchingInstants.length === 0) {
    throw new RangeError('That local time does not exist because the clock changes in this time zone. Choose another time.');
  }

  // During a repeated fall-back hour, choose the earlier occurrence consistently.
  return new Date(matchingInstants[0]);
}

export function formatInstantInTimeZone(value: string, timeZone: string): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return value;
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: getRentalTimeZone(timeZone),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(instant);
}
