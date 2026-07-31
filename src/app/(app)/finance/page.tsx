import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { can } from '@/lib/rbac';
import { formatSen } from '@/lib/money';
import { formatDateTime, formatWeekRange } from '@/lib/cycle';
import { departmentBreakdown, trailingWeeks, weeklyTotals } from '@/lib/reporting';
import { hitpayConfigured } from '@/lib/hitpay';
import { PageHeader, Section, Stat, StatusBadge, Alert, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

const RANGES = [4, 8, 12, 26] as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ weeks?: string }>;
}) {
  const user = await requireCapability('finance:view');
  const params = await searchParams;

  const requested = Number.parseInt(params.weeks ?? '', 10);
  const weeks = (RANGES as readonly number[]).includes(requested) ? requested : 12;
  const window = trailingWeeks(weeks);

  const [weekly, departments, pending, recentPayments, failedCount] = await Promise.all([
    weeklyTotals(window),
    departmentBreakdown(window),
    prisma.order.aggregate({
      where: { status: 'AWAITING_PAYMENT' },
      _count: { _all: true },
      _sum: { netSen: true },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        order: {
          select: {
            reference: true,
            user: { select: { name: true, staffId: true } },
            cycle: { select: { serviceWeekStart: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
  ]);

  const gross = weekly.reduce((s, w) => s + w.grossSen, 0);
  const subsidy = weekly.reduce((s, w) => s + w.subsidySen, 0);
  const net = weekly.reduce((s, w) => s + w.netSen, 0);
  const orders = weekly.reduce((s, w) => s + w.orders, 0);

  const exportable = can(user.role, 'finance:export');
  const latestCycle = weekly.length ? weekly[weekly.length - 1] : null;

  const rangeSwitcher = (
    <form method="get" className="flex items-center gap-2">
      <select name="weeks" defaultValue={String(weeks)} className="input !w-32 !py-1 text-xs">
        {RANGES.map((r) => (
          <option key={r} value={r}>
            Last {r} weeks
          </option>
        ))}
      </select>
      <button type="submit" className="btn-secondary btn-sm">
        Apply
      </button>
    </form>
  );

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle={`Meal spend, company subsidy cost and HitPay reconciliation over the last ${weeks} weeks.`}
        action={rangeSwitcher}
      />

      <div className="mb-6 space-y-3">
        {!hitpayConfigured() ? (
          <Alert tone="warning">
            HitPay is not configured, so staff cannot pay online. Add <code>HITPAY_API_KEY</code> and{' '}
            <code>HITPAY_SALT</code> to the environment.
          </Alert>
        ) : null}

        {exportable ? (
          <Alert tone="info">
            Exports include employee names and staff IDs. Keep them on approved systems and share only
            within Finance and HR.
          </Alert>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Food value" value={formatSen(gross)} hint={`${orders} paid orders`} />
        <Stat
          label="Company subsidy cost"
          value={formatSen(subsidy)}
          tone="positive"
          hint={gross ? `${Math.round((subsidy / gross) * 100)}% of food value` : undefined}
        />
        <Stat label="Collected from staff" value={formatSen(net)} hint="via HitPay" />
        <Stat
          label="Awaiting payment"
          value={formatSen(pending._sum.netSen ?? 0)}
          tone={pending._count._all > 0 ? 'warning' : 'default'}
          hint={`${pending._count._all} order(s) not settled`}
        />
      </div>

      {weekly.length === 0 ? (
        <EmptyState title="No service weeks in this range" hint="Try a longer range." />
      ) : (
        <div className="grid gap-6">
          <Section
            title="By service week"
            description="Paid orders only"
            action={
              exportable ? (
                <a href={`/api/exports/subsidy?weeks=${weeks}`} className="btn-secondary btn-sm">
                  Export summary CSV
                </a>
              ) : null
            }
          >
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service week</th>
                    <th>Status</th>
                    <th className="num">Orders</th>
                    <th className="num">Meals</th>
                    <th className="num">Food value</th>
                    <th className="num">Company pays</th>
                    <th className="num">Staff pays</th>
                    <th className="num">Subsidy %</th>
                    {exportable ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {[...weekly].reverse().map((w) => (
                    <tr key={w.cycleId}>
                      <td className="font-medium text-slate-900">{w.label}</td>
                      <td className="text-xs text-slate-500">{w.status}</td>
                      <td className="num text-slate-600">{w.orders}</td>
                      <td className="num text-slate-600">{w.meals}</td>
                      <td className="num text-slate-900">{formatSen(w.grossSen)}</td>
                      <td className="num text-emerald-700">{formatSen(w.subsidySen)}</td>
                      <td className="num text-slate-900">{formatSen(w.netSen)}</td>
                      <td className="num text-slate-600">
                        {w.grossSen ? `${Math.round((w.subsidySen / w.grossSen) * 100)}%` : '—'}
                      </td>
                      {exportable ? (
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <a href={`/api/exports/orders?cycle=${w.cycleId}`} className="btn-secondary btn-sm">
                              Orders
                            </a>
                            <a href={`/api/exports/payments?cycle=${w.cycleId}`} className="btn-secondary btn-sm">
                              Payments
                            </a>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Subsidy cost by department" description="Where the company contribution goes">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th className="num">People</th>
                      <th className="num">Orders</th>
                      <th className="num">Company pays</th>
                      <th className="num">Staff pays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => (
                      <tr key={d.department}>
                        <td className="font-medium text-slate-900">{d.department}</td>
                        <td className="num text-slate-600">{d.people}</td>
                        <td className="num text-slate-600">{d.orders}</td>
                        <td className="num text-emerald-700">{formatSen(d.subsidySen)}</td>
                        <td className="num text-slate-900">{formatSen(d.netSen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Recent HitPay activity"
              description={failedCount > 0 ? `${failedCount} failed attempt(s) on record` : 'Last 15 transactions'}
              action={
                exportable ? (
                  <a href="/api/exports/payments" className="btn-secondary btn-sm">
                    Export all
                  </a>
                ) : null
              }
            >
              {recentPayments.length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Employee</th>
                        <th className="num">Amount</th>
                        <th>Status</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPayments.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <Link
                              href={`/orders/${p.order.reference}`}
                              className="font-mono text-xs text-slate-700 hover:text-brand-700"
                            >
                              {p.order.reference}
                            </Link>
                            <div className="text-xs text-slate-400">
                              {formatWeekRange(p.order.cycle.serviceWeekStart)}
                            </div>
                          </td>
                          <td className="text-slate-700">
                            {p.order.user.name}
                            {p.order.user.staffId ? (
                              <div className="text-xs text-slate-400">{p.order.user.staffId}</div>
                            ) : null}
                          </td>
                          <td className="num text-slate-900">{formatSen(p.amountSen)}</td>
                          <td>
                            <StatusBadge status={p.status} />
                            {p.failureReason ? (
                              <div className="mt-0.5 text-xs text-red-600">{p.failureReason}</div>
                            ) : null}
                          </td>
                          <td className="text-xs text-slate-500">{formatDateTime(p.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        </div>
      )}

      {latestCycle && exportable ? (
        <p className="mt-6 text-xs text-slate-500">
          Tip: the per-week <strong>Orders</strong> export is the file to hand to payroll or to
          reconcile against a HitPay settlement report.
        </p>
      ) : null}
    </>
  );
}
