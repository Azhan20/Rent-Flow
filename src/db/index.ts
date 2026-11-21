import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { createApplicationPoolOptions } from './postgres-config';

declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool using the object method
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(createApplicationPoolOptions(process.env));

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err.name);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
