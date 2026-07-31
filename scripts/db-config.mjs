import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves which database provider to use and, for SQLite, derives a
 * SQLite-flavoured schema from the Postgres one.
 *
 * `prisma/schema.prisma` stays the single hand-edited source of truth and is
 * written in Postgres form. Prisma does not allow `provider = env(...)`, so
 * the SQLite variant has to be a real file on disk - it is generated into
 * `prisma/schema.sqlite.prisma` and gitignored.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PG_SCHEMA = join(ROOT, 'prisma', 'schema.prisma');
export const SQLITE_SCHEMA = join(ROOT, 'prisma', 'schema.sqlite.prisma');

// Relative forms for the CLI: the project path may contain spaces, which
// Windows' shell-based spawn would split into separate arguments.
export const PG_SCHEMA_REL = 'prisma/schema.prisma';
export const SQLITE_SCHEMA_REL = 'prisma/schema.sqlite.prisma';

/** Default when nothing is configured: a file next to the schema. */
export const DEFAULT_SQLITE_URL = 'file:./dev.db';

/** Minimal .env reader - we need DATABASE_URL before Prisma loads it itself. */
export function readEnvFile(file = join(ROOT, '.env')) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

/**
 * Decide the provider. Explicit DATABASE_PROVIDER wins; otherwise it is
 * inferred from the URL scheme; with no URL at all we fall back to SQLite so
 * the app runs with no setup.
 */
export function resolveDatabase() {
  const fileEnv = readEnvFile();
  const url = process.env.DATABASE_URL || fileEnv.DATABASE_URL || '';
  const explicit = (process.env.DATABASE_PROVIDER || fileEnv.DATABASE_PROVIDER || '').toLowerCase();

  let provider;
  if (explicit === 'postgresql' || explicit === 'postgres') provider = 'postgresql';
  else if (explicit === 'sqlite') provider = 'sqlite';
  else if (/^postgres(ql)?:\/\//i.test(url)) provider = 'postgresql';
  else if (/^file:/i.test(url)) provider = 'sqlite';
  else provider = 'sqlite';

  const resolvedUrl = url || (provider === 'sqlite' ? DEFAULT_SQLITE_URL : '');
  const inferred = !url;

  return {
    provider,
    url: resolvedUrl,
    inferred,
    schema: provider === 'sqlite' ? SQLITE_SCHEMA_REL : PG_SCHEMA_REL,
  };
}

/**
 * Rewrite the Postgres schema into a SQLite-compatible one.
 *
 * SQLite in Prisma supports enums and Json, but not scalar lists or the
 * `@db.Date` native type. Both differences are handled in app code by
 * `src/lib/db-compat.ts`.
 */
export function writeSqliteSchema() {
  const source = readFileSync(PG_SCHEMA, 'utf8');

  let out = source
    // 1. Swap the connector.
    .replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"')
    // 2. No native date-only type; the app already normalises these to UTC
    //    midnight, so a plain DateTime behaves identically.
    .replace(/\s+@db\.Date\b/g, '')
    // 3. No scalar lists. Tags become a delimited string - see encodeTags().
    .replace(/String\[\]\s*@default\(\[\]\)/g, 'String  @default("")');

  // Relations are lists too (`Dish[]`), so only flag lists of *scalar* types -
  // those are the ones SQLite cannot represent.
  const SCALARS = 'String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json|Bytes';
  const leftover = new RegExp(`^\\s*\\w+\\s+(?:${SCALARS})\\[\\]`, 'm').exec(
    out.replace(/^\s*\/\/.*$/gm, ''),
  );

  out =
    `// ---------------------------------------------------------------------------\n` +
    `// GENERATED FILE - DO NOT EDIT.\n` +
    `// Derived from prisma/schema.prisma by scripts/db-config.mjs.\n` +
    `// Edit prisma/schema.prisma instead, then re-run any npm db:* script.\n` +
    `// ---------------------------------------------------------------------------\n\n` +
    out;

  writeFileSync(SQLITE_SCHEMA, out, 'utf8');
  return { path: SQLITE_SCHEMA, leftover: leftover ? leftover[0].trim() : null };
}

/**
 * SQLite is a development convenience. On a serverless host the filesystem is
 * ephemeral and not shared between invocations, so a SQLite deploy would
 * build cleanly and then lose data at runtime - fail the build instead.
 */
function assertNotSqliteInProduction(db) {
  const hosted = process.env.VERCEL || process.env.NETLIFY || process.env.RENDER;
  if (db.provider !== 'sqlite' || !hosted) return;

  // Easy mistake: Supabase hands you DIRECT_URL / POSTGRES_URL and it is
  // tempting to paste it into whichever box is open. Prisma reads
  // DATABASE_URL, so say so by name rather than just failing.
  const fileEnv = readEnvFile();
  const strays = ['DIRECT_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'].filter(
    (k) => process.env[k] || fileEnv[k],
  );
  const hint = strays.length
    ? `\n\nFound ${strays.join(', ')} but no DATABASE_URL. Prisma reads DATABASE_URL -\n` +
      'rename it, or copy the same connection string into DATABASE_URL.'
    : '';

  throw new Error(
    'DATABASE_URL is not set to a Postgres database.\n' +
      'This app falls back to SQLite locally, but SQLite cannot be used on a\n' +
      'serverless host - the filesystem is ephemeral and per-invocation.\n' +
      'Set DATABASE_URL to a Postgres connection string in your project settings.' +
      hint,
  );
}

/** Prepare whatever the chosen provider needs and return the schema path. */
export function prepareSchema() {
  const db = resolveDatabase();
  assertNotSqliteInProduction(db);
  if (db.provider === 'sqlite') {
    const { leftover } = writeSqliteSchema();
    if (leftover) {
      console.warn(
        `\n  ! prisma/schema.prisma has a scalar list SQLite cannot store:\n` +
          `      ${leftover}\n` +
          `    Add a rule in scripts/db-config.mjs and a codec in src/lib/db-compat.ts.\n`,
      );
    }
  }
  return db;
}
