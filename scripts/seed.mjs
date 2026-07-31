#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import { prepareSchema } from './db-config.mjs';

/** Runs prisma/seed.ts with DATABASE_URL resolved the same way as the CLI. */

const db = prepareSchema();
console.log(`  · seeding  [${db.provider}]`);

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', 'prisma/seed.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: db.url, DATABASE_PROVIDER: db.provider },
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
