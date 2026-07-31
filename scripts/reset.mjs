#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareSchema } from './db-config.mjs';

/**
 * Drop everything and recreate an empty schema. Development only.
 *
 * For SQLite this deletes the database file, which is both the simplest and
 * the most complete reset. For Postgres it delegates to `prisma migrate
 * reset`, which runs its own confirmation prompt.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = prepareSchema();

if (db.provider === 'sqlite') {
  const raw = db.url.replace(/^file:/i, '');
  // Relative SQLite paths are resolved against the schema's directory.
  const file = isAbsolute(raw) ? raw : join(ROOT, 'prisma', raw);

  if (!existsSync(file)) {
    console.log(`  · no database at ${file} - nothing to delete`);
  } else {
    console.log(`  ! deleting SQLite database ${file}`);
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const path = `${file}${suffix}`;
      if (existsSync(path)) rmSync(path);
    }
  }

  const push = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'push', '--schema', db.schema, '--skip-generate'],
    { stdio: 'inherit', env: { ...process.env, DATABASE_URL: db.url }, shell: process.platform === 'win32' },
  );
  process.exit(push.status ?? 1);
}

console.log('  ! resetting the Postgres database - prisma will ask you to confirm');
const reset = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'reset', '--schema', db.schema],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: db.url }, shell: process.platform === 'win32' },
);
process.exit(reset.status ?? 1);
