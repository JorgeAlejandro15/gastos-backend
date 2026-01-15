/*
 * Cross-platform migration generator for TypeORM.
 * Usage:
 *   pnpm db:migration:generate -- <MigrationName>
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const name = process.argv[2];
if (!name || name.startsWith('-')) {
  console.error('Missing migration name. Example: pnpm db:migration:generate -- CreateUsersTable');
  process.exit(1);
}

const dataSourcePath = path.join('src', 'database', 'data-source.ts');
const outPath = path.join('src', 'database', 'migrations', name);

// In npm/pnpm scripts, node_modules/.bin is on PATH, including on Windows (.cmd).
const bin = 'typeorm-ts-node-commonjs';
const args = ['-d', dataSourcePath, 'migration:generate', outPath, '-p'];

const result = spawnSync(bin, args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
