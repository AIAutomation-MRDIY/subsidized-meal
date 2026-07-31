/**
 * Postgres / SQLite compatibility.
 *
 * The app runs on either connector. Prisma's SQLite support covers enums and
 * Json but not scalar lists, the `@db.Date` native type, or case-insensitive
 * string filters. `scripts/db-config.mjs` handles the schema side; this module
 * handles the query and value side.
 *
 * Keep this list short - every entry is a place the two databases behave
 * differently, and each one is a chance for them to drift.
 */

function detectProvider(): 'postgresql' | 'sqlite' {
  const explicit = (process.env.DATABASE_PROVIDER ?? '').toLowerCase();
  if (explicit === 'postgresql' || explicit === 'postgres') return 'postgresql';
  if (explicit === 'sqlite') return 'sqlite';

  const url = process.env.DATABASE_URL ?? '';
  if (/^postgres(ql)?:\/\//i.test(url)) return 'postgresql';
  return 'sqlite';
}

export const DB_PROVIDER = detectProvider();
export const IS_SQLITE = DB_PROVIDER === 'sqlite';

// ---------------------------------------------------------------------------
// Dish.tags - String[] on Postgres, a delimited String on SQLite
// ---------------------------------------------------------------------------

const TAG_SEPARATOR = ',';

/**
 * Prepare tags for writing. The return type is an intersection so the value
 * satisfies whichever shape the generated client expects, without every call
 * site needing its own cast.
 */
export function encodeTags(tags: string[]): string[] & string {
  const clean = tags.map((t) => t.trim()).filter(Boolean);
  return (IS_SQLITE ? clean.join(TAG_SEPARATOR) : clean) as string[] & string;
}

/** Read tags back out, whichever way they were stored. */
export function decodeTags(value: string[] | string | null | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(TAG_SEPARATOR)
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Case-insensitive search
// ---------------------------------------------------------------------------

/**
 * A `contains` filter that ignores case on both connectors.
 *
 * Postgres needs an explicit `mode: 'insensitive'`; SQLite's LIKE is already
 * case-insensitive for ASCII and rejects the `mode` argument outright.
 */
export function containsInsensitive(value: string): { contains: string; mode?: 'insensitive' } {
  return IS_SQLITE ? { contains: value } : { contains: value, mode: 'insensitive' };
}

// ---------------------------------------------------------------------------
// createMany
// ---------------------------------------------------------------------------

/**
 * `skipDuplicates` is a Postgres-only option - the SQLite client types it as
 * `undefined` and rejects it outright. Spread this into a createMany call
 * rather than passing the flag directly.
 *
 * The return type is deliberately empty. The two generated clients disagree
 * about this option's shape, so it is kept out of the type system and the
 * runtime value does the work. Spreading an empty type contributes nothing,
 * which is exactly what both clients will accept.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function skipDuplicates(): {} {
  return IS_SQLITE ? {} : { skipDuplicates: true };
}
