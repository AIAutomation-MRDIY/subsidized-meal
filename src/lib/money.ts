/**
 * Money helpers.
 *
 * Every amount in the database is an integer number of *sen*. Never do
 * arithmetic on the formatted string, and never introduce a float.
 */

export const CURRENCY = process.env.HITPAY_CURRENCY ?? 'MYR';

/** 1234 -> "RM 12.34" */
export function formatSen(sen: number, opts?: { withSymbol?: boolean }): string {
  const withSymbol = opts?.withSymbol ?? true;
  const abs = Math.abs(Math.round(sen));
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = String(abs % 100).padStart(2, '0');
  const sign = sen < 0 ? '-' : '';
  return withSymbol ? `${sign}RM ${whole}.${cents}` : `${sign}${whole}.${cents}`;
}

/** 12.34 -> 1234. Used when parsing admin price input. */
export function ringgitToSen(input: string | number): number {
  const n =
    typeof input === 'number' ? input : Number.parseFloat(String(input).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

/** 1234 -> 12.34. HitPay expects a decimal amount, not sen. */
export function senToRinggit(sen: number): number {
  return Math.round(sen) / 100;
}

/** Guard against negative or absurd amounts making it into the DB. */
export function assertValidSen(sen: number, label = 'amount'): number {
  if (!Number.isInteger(sen) || sen < 0) {
    throw new Error(`Invalid ${label}: must be a non-negative whole number of sen`);
  }
  if (sen > 100_000_00) {
    throw new Error(`Invalid ${label}: exceeds RM 100,000`);
  }
  return sen;
}
