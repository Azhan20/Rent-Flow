import type { TestingDatabaseTarget } from './drizzle-config-validation';

const POSTGRES_URL_PATTERN = /\bpostgres(?:ql)?:\/\/[^\s"'`<>]+/gi;
const CONNECTION_STRING_FIELD_PATTERN =
  /(\b(?:DATABASE_URL|connectionString|connection string)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

function percentEscapeCaseVariants(value: string): string[] {
  return [
    value,
    value.replace(/%[0-9a-f]{2}/gi, (escape) => escape.toLowerCase()),
    value.replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase()),
  ];
}

export function collectDatabaseSecrets(
  connectionUrl: string,
  target: Pick<TestingDatabaseTarget, 'user' | 'password'>,
): string[] {
  const users = [target.user, target.user.toLowerCase(), target.user.toUpperCase()];
  const secrets = new Set([connectionUrl, target.user, target.password]);

  for (const user of users) {
    for (const encoded of percentEscapeCaseVariants(encodeURIComponent(user))) {
      secrets.add(encoded);
    }
  }
  for (const encoded of percentEscapeCaseVariants(encodeURIComponent(target.password))) {
    secrets.add(encoded);
  }

  try {
    const parsedUrl = new URL(connectionUrl);
    secrets.add(parsedUrl.username);
    secrets.add(parsedUrl.password);
  } catch {
    // The full input is still redacted as a value; config validation rejects malformed URLs.
  }

  return [...secrets].filter((secret) => secret.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactMigrationOutput(output: string, secrets: readonly string[]): string {
  let redacted = output
    .replace(POSTGRES_URL_PATTERN, '[REDACTED DATABASE URL]')
    .replace(CONNECTION_STRING_FIELD_PATTERN, '$1[REDACTED DATABASE URL]');

  const uniqueSecrets = [...new Set(secrets.filter((secret) => secret.length > 0))].sort(
    (left, right) => right.length - left.length,
  );

  for (const secret of uniqueSecrets) {
    const secretPattern = new RegExp(
      `(?<![\\p{L}\\p{N}_])${escapeRegExp(secret)}(?![\\p{L}\\p{N}_])`,
      'gu',
    );
    redacted = redacted.replace(secretPattern, '[REDACTED]');
  }

  return redacted;
}
