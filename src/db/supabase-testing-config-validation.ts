import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

const SUPABASE_TEST_PROJECT_REF = 'dgasadodjzpjofkvjkbw';
const SUPABASE_TEST_POOLER_HOST = 'aws-1-ap-northeast-1.pooler.supabase.com';
const SUPABASE_TEST_POOLER_PORT = 5432;
const SUPABASE_TEST_DATABASE = 'postgres';

export type SupabaseTestingEnvironment = {
  SUPABASE_TEST_DATABASE_URL?: string;
  /** Provide runtime credentials through the deployment secret manager; never commit or inline them. */
  SUPABASE_TEST_RUNTIME_DATABASE_URL?: string;
  SUPABASE_TEST_CA_CERT?: string;
};

export type SupabaseTestingDatabaseTarget = {
  host: typeof SUPABASE_TEST_POOLER_HOST;
  port: typeof SUPABASE_TEST_POOLER_PORT;
  user: string;
  password: string;
  database: typeof SUPABASE_TEST_DATABASE;
  ssl: {
    ca: string;
    rejectUnauthorized: true;
    servername: typeof SUPABASE_TEST_POOLER_HOST;
  };
};

export function validateSupabaseTestingDatabaseTarget(
  env: SupabaseTestingEnvironment,
  projectRoot: string,
): SupabaseTestingDatabaseTarget {
  return validateSupabaseTarget(
    env.SUPABASE_TEST_DATABASE_URL,
    `postgres.${SUPABASE_TEST_PROJECT_REF}`,
    'SUPABASE_TEST_DATABASE_URL',
    'approved project-specific database login',
    env.SUPABASE_TEST_CA_CERT,
    projectRoot,
  );
}

export function validateSupabaseTestRuntimeDatabaseTarget(
  env: SupabaseTestingEnvironment,
  projectRoot: string,
): SupabaseTestingDatabaseTarget {
  return validateSupabaseTarget(
    env.SUPABASE_TEST_RUNTIME_DATABASE_URL,
    `rentflow_runtime_login.${SUPABASE_TEST_PROJECT_REF}`,
    'SUPABASE_TEST_RUNTIME_DATABASE_URL',
    'approved Supabase TEST runtime login',
    env.SUPABASE_TEST_CA_CERT,
    projectRoot,
  );
}

function validateSupabaseTarget(
  connectionUrl: string | undefined,
  expectedUser: string,
  connectionVariable: 'SUPABASE_TEST_DATABASE_URL' | 'SUPABASE_TEST_RUNTIME_DATABASE_URL',
  expectedLoginDescription: string,
  certificatePath: string | undefined,
  projectRoot: string,
): SupabaseTestingDatabaseTarget {
  if (!connectionUrl) {
    throw new Error(`${connectionVariable} is required for the Supabase testing target.`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionUrl);
  } catch {
    throw new Error(`${connectionVariable} must be a valid PostgreSQL URL.`);
  }

  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new Error(`${connectionVariable} must use the PostgreSQL protocol.`);
  }
  if (parsedUrl.hostname !== SUPABASE_TEST_POOLER_HOST) {
    throw new Error(`${connectionVariable} must use the exact approved Supabase testing pooler.`);
  }

  const port = parsedUrl.port ? Number(parsedUrl.port) : 5432;
  if (port !== SUPABASE_TEST_POOLER_PORT) {
    throw new Error(`${connectionVariable} must use the approved Supabase session pooler port.`);
  }
  if (parsedUrl.pathname !== `/${SUPABASE_TEST_DATABASE}`) {
    throw new Error(`${connectionVariable} must select the postgres testing database.`);
  }

  let user: string;
let password: string;

try {
  user = decodeURIComponent(parsedUrl.username);
  password = decodeURIComponent(parsedUrl.password);
} catch {
  throw new Error(`${connectionVariable} contains invalid encoded credentials.`);
}

if (user !== expectedUser || !password) {
  throw new Error(`${connectionVariable} must use the ${expectedLoginDescription}.`);
}

  if (!certificatePath || !isAbsolute(certificatePath)) {
    throw new Error('SUPABASE_TEST_CA_CERT must be an absolute path to the Supabase project CA certificate.');
  }

  let certificatePem: string;
  let certificate: X509Certificate;
  try {
    certificatePem = readFileSync(resolve(projectRoot, certificatePath), 'utf8');
    certificate = new X509Certificate(certificatePem);
  } catch {
    throw new Error('SUPABASE_TEST_CA_CERT could not be loaded as an X.509 certificate.');
  }

  const now = Date.now();
  if (!certificate.ca || certificate.validFromDate.getTime() > now || certificate.validToDate.getTime() <= now) {
    throw new Error('SUPABASE_TEST_CA_CERT must be a currently valid CA certificate.');
  }

  return {
    host: SUPABASE_TEST_POOLER_HOST,
    port: SUPABASE_TEST_POOLER_PORT,
    user,
    password,
    database: SUPABASE_TEST_DATABASE,
    ssl: {
      ca: certificatePem,
      rejectUnauthorized: true,
      servername: SUPABASE_TEST_POOLER_HOST,
    },
  };
}

export const SUPABASE_TEST_PROJECT_REF_VALUE = SUPABASE_TEST_PROJECT_REF;
export const SUPABASE_TEST_RUNTIME_LOGIN = `rentflow_runtime_login.${SUPABASE_TEST_PROJECT_REF}`;
