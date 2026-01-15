# Migrations

This folder contains TypeORM migrations.

## Typical workflow

- Generate a migration from entity changes:

  - `pnpm db:migration:generate -- <MigrationName>`

- Run pending migrations:

  - `pnpm db:migration:run`

- Revert last migration:
  - `pnpm db:migration:revert`

Notes:

- The TypeORM CLI uses `src/database/data-source.ts`.
- Environment variables are loaded from `.env`.
