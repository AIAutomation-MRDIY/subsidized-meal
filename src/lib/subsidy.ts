import type { SubsidyRule } from '@prisma/client';

import { toDateKey } from './cycle';

/**
 * Company subsidy engine.
 *
 * Model, deliberately kept explainable so Finance can reconcile by hand:
 *
 *   1. Pick ONE per-item rule per line - the highest-priority applicable
 *      PERCENTAGE / FIXED_PER_ITEM rule. A DEPARTMENT rule outranks an ALL
 *      rule at equal priority.
 *   2. Apply it per unit, never exceeding the unit price (no cash back).
 *   3. Apply the day cap - the applicable FIXED_PER_DAY rule limits total
 *      subsidy across every line sharing a service date, scaled down
 *      proportionally with exact integer conservation.
 *
 * Everything is in sen; no floats survive past the proportional split.
 */

export type SubsidyLineInput = {
  /** Stable key for matching results back to the caller's rows. */
  key: string;
  serviceDate: Date;
  unitPriceSen: number;
  quantity: number;
};

export type SubsidyLineResult = {
  key: string;
  grossSen: number;
  subsidySen: number;
  netSen: number;
  /** Rules that touched this line, for the audit snapshot. */
  appliedRuleIds: string[];
};

export type SubsidyOutcome = {
  lines: SubsidyLineResult[];
  grossSen: number;
  subsidySen: number;
  netSen: number;
  snapshot: SubsidySnapshot;
};

export type SubsidySnapshot = {
  computedAt: string;
  department: string | null;
  rules: Array<{
    id: string;
    name: string;
    type: SubsidyRule['type'];
    value: number;
    capSen: number | null;
    scope: SubsidyRule['scope'];
    department: string | null;
    priority: number;
  }>;
};

const PER_ITEM_TYPES = new Set<SubsidyRule['type']>(['PERCENTAGE', 'FIXED_PER_ITEM']);

function isEffective(rule: SubsidyRule, on: Date): boolean {
  if (!rule.active) return false;
  const day = toDateKey(on);
  if (rule.effectiveFrom && toDateKey(rule.effectiveFrom) > day) return false;
  if (rule.effectiveTo && toDateKey(rule.effectiveTo) < day) return false;
  return true;
}

function matchesScope(rule: SubsidyRule, department: string | null): boolean {
  if (rule.scope === 'ALL') return true;
  if (!rule.department || !department) return false;
  return rule.department.toLowerCase() === department.toLowerCase();
}

/** Higher wins. DEPARTMENT outranks ALL when priority ties. */
function rank(rule: SubsidyRule): [number, number] {
  return [rule.priority, rule.scope === 'DEPARTMENT' ? 1 : 0];
}

function bestRule(candidates: SubsidyRule[]): SubsidyRule | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, r) => {
    const [bp, bs] = rank(best);
    const [rp, rs] = rank(r);
    if (rp !== bp) return rp > bp ? r : best;
    if (rs !== bs) return rs > bs ? r : best;
    return best;
  });
}

function perUnitSubsidy(rule: SubsidyRule, unitPriceSen: number): number {
  let amount: number;
  if (rule.type === 'PERCENTAGE') {
    amount = Math.floor((unitPriceSen * rule.value) / 100);
  } else {
    amount = rule.value;
  }
  if (rule.capSen != null) amount = Math.min(amount, rule.capSen);
  // Never subsidise more than the item costs.
  return Math.max(0, Math.min(amount, unitPriceSen));
}

export function calculateSubsidy(
  lines: SubsidyLineInput[],
  rules: SubsidyRule[],
  department: string | null,
): SubsidyOutcome {
  const usedRules = new Map<string, SubsidyRule>();

  // --- Step 1 & 2: per-item subsidy -----------------------------------
  const working = lines.map((line) => {
    const gross = line.unitPriceSen * line.quantity;
    const candidates = rules.filter(
      (r) =>
        PER_ITEM_TYPES.has(r.type) &&
        isEffective(r, line.serviceDate) &&
        matchesScope(r, department),
    );
    const rule = bestRule(candidates);
    const applied: string[] = [];
    let subsidy = 0;

    if (rule) {
      subsidy = perUnitSubsidy(rule, line.unitPriceSen) * line.quantity;
      if (subsidy > 0) {
        applied.push(rule.id);
        usedRules.set(rule.id, rule);
      }
    }

    return { line, gross, subsidy, applied };
  });

  // --- Step 3: per-day cap --------------------------------------------
  const byDay = new Map<string, typeof working>();
  for (const row of working) {
    const key = toDateKey(row.line.serviceDate);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(row);
    else byDay.set(key, [row]);
  }

  for (const [, rows] of byDay) {
    const serviceDate = rows[0].line.serviceDate;
    const dayRule = bestRule(
      rules.filter(
        (r) =>
          r.type === 'FIXED_PER_DAY' && isEffective(r, serviceDate) && matchesScope(r, department),
      ),
    );
    if (!dayRule) continue;

    const total = rows.reduce((s, r) => s + r.subsidy, 0);
    if (total <= dayRule.value) continue;

    scaleDown(rows, dayRule.value, total);
    usedRules.set(dayRule.id, dayRule);
    for (const row of rows)
      if (row.subsidy > 0 && !row.applied.includes(dayRule.id)) row.applied.push(dayRule.id);
  }

  // --- Assemble --------------------------------------------------------
  const results: SubsidyLineResult[] = working.map((r) => ({
    key: r.line.key,
    grossSen: r.gross,
    subsidySen: r.subsidy,
    netSen: r.gross - r.subsidy,
    appliedRuleIds: r.applied,
  }));

  const grossSen = results.reduce((s, r) => s + r.grossSen, 0);
  const subsidySen = results.reduce((s, r) => s + r.subsidySen, 0);

  return {
    lines: results,
    grossSen,
    subsidySen,
    netSen: grossSen - subsidySen,
    snapshot: {
      computedAt: new Date().toISOString(),
      department,
      rules: [...usedRules.values()].map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        value: r.value,
        capSen: r.capSen,
        scope: r.scope,
        department: r.department,
        priority: r.priority,
      })),
    },
  };
}

/**
 * Reduce each row's subsidy proportionally so the rows sum to exactly `cap`.
 * Floor first, then hand the leftover sen to the largest fractional parts -
 * this guarantees the integers add up with no rounding drift.
 */
function scaleDown(rows: Array<{ subsidy: number }>, cap: number, total: number): void {
  const exact = rows.map((r) => (r.subsidy * cap) / total);
  const floored = exact.map((n) => Math.floor(n));
  let remainder = cap - floored.reduce((s, n) => s + n, 0);

  const order = exact
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);

  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i] += 1;
    remainder -= 1;
  }

  rows.forEach((r, i) => {
    r.subsidy = floored[i];
  });
}

/**
 * What one dish costs a given employee, after the company's contribution.
 *
 * This is exact only because staff order at most one meal per service day
 * (`MEALS_PER_DAY`), so a FIXED_PER_DAY cap can never be shared with another
 * line on the same date. If multi-meal days are ever enabled, a per-dish
 * price stops being knowable in isolation and this must go.
 */
export function employeePriceFor(
  unitPriceSen: number,
  serviceDate: Date,
  rules: SubsidyRule[],
  department: string | null,
): number {
  const outcome = calculateSubsidy(
    [{ key: 'one', serviceDate, unitPriceSen, quantity: 1 }],
    rules,
    department,
  );
  return outcome.lines[0]?.netSen ?? unitPriceSen;
}

export function describeRule(rule: Pick<SubsidyRule, 'type' | 'value' | 'capSen'>): string {
  const rm = (sen: number) => `RM ${(sen / 100).toFixed(2)}`;
  switch (rule.type) {
    case 'PERCENTAGE':
      return rule.capSen != null
        ? `${rule.value}% off, max ${rm(rule.capSen)} per item`
        : `${rule.value}% off each item`;
    case 'FIXED_PER_ITEM':
      return `${rm(rule.value)} off each item`;
    case 'FIXED_PER_DAY':
      return `up to ${rm(rule.value)} per day`;
  }
}
