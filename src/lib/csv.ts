/**
 * Minimal RFC 4180 CSV writer.
 *
 * Values are always quoted and a leading apostrophe is added to anything
 * that Excel would otherwise treat as a formula - a CSV opened by Finance
 * must never execute `=cmd|...`.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

function escapeCell(value: unknown): string {
  if (value == null) return '""';
  let s = String(value);
  if (s.length > 0 && FORMULA_TRIGGERS.includes(s[0])) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  // BOM so Excel on Windows reads UTF-8 correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Amounts in exports are decimal ringgit so spreadsheets can sum them. */
export function csvAmount(sen: number): string {
  return (sen / 100).toFixed(2);
}
