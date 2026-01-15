import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env';

// Loads environment variables for TypeORM CLI usage (migrations).
// Nest loads env vars via ConfigModule, but the CLI runs outside Nest.
dotenvConfig({ path: resolve(process.cwd(), '.env') });

const env = validateEnv(process.env as unknown as Record<string, unknown>);

const ssl =
  env.DB_SSL === 'true' ? { rejectUnauthorized: false } : (false as const);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl,

  // IMPORTANT:
  // - Keep `synchronize: false` for migrations; schema changes should go through migrations.
  // - Your runtime config can still set synchronize=true in development if you want.
  synchronize: false,
  logging: env.TYPEORM_LOGGING === 'true',

  // These globs work both from src (ts-node) and from dist (compiled js).
  entities: [resolve(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [resolve(__dirname, 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'migrations',
});

export default AppDataSource;
