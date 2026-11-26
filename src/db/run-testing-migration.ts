import { spawn } from 'node:child_process';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import {
  resolveProjectRootFromConfigUrl,
  validateTestingDatabaseTarget,
} from './drizzle-config-validation';
import {
  collectDatabaseSecrets,
  redactMigrationOutput,
} from './migration-output-redaction';

const expectedConfigArgument = '--config=src/db/drizzle.config.ts';
const projectRoot = resolveProjectRootFromConfigUrl(import.meta.url);

if (process.argv.length !== 3 || process.argv[2] !== expectedConfigArgument) {
  console.error('The testing migration runner requires its fixed Drizzle configuration.');
  process.exitCode = 1;
} else {
  dotenv.config({ path: resolve(projectRoot, '.env') });

  try {
    const target = validateTestingDatabaseTarget({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_SSL: process.env.DATABASE_SSL,
    });
    const connectionUrl = process.env.DATABASE_URL ?? '';
    const secrets = collectDatabaseSecrets(connectionUrl, target);
    const drizzleKitCli = resolve(projectRoot, 'node_modules', 'drizzle-kit', 'bin.cjs');
    const configPath = resolve(projectRoot, 'src', 'db', 'drizzle.config.ts');
    const child = spawn(process.execPath, [drizzleKitCli, 'migrate', `--config=${configPath}`], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let spawnError = '';

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error: Error) => {
      spawnError = error.message;
    });
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      process.stdout.write(redactMigrationOutput(stdout, secrets));
      process.stderr.write(redactMigrationOutput(`${stderr}${spawnError}`, secrets));

      if (code === null) {
        if (signal) {
          process.stderr.write(`Drizzle Kit stopped after signal ${signal}.\n`);
        }
        process.exitCode = 1;
        return;
      }

      process.exitCode = code >= 0 ? code : 1;
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Testing migration configuration is invalid.';
    process.stderr.write(redactMigrationOutput(`${message}\n`, secretsFromEnvironment()));
    process.exitCode = 1;
  }
}

function secretsFromEnvironment(): string[] {
  const connectionUrl = process.env.DATABASE_URL ?? '';
  const secrets = [connectionUrl];

  try {
    const target = validateTestingDatabaseTarget({
      DATABASE_URL: connectionUrl,
      DATABASE_SSL: process.env.DATABASE_SSL,
    });
    secrets.push(...collectDatabaseSecrets(connectionUrl, target));
  } catch {
    // Invalid target errors are generic; retain only the full URL redactor here.
  }

  return secrets;
}
