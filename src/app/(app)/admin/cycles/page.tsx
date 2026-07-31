import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { formatSen } from '@/lib/money';
import {
  CYCLE_PHASE_LABEL,
  cyclePhase,
  formatDateTime,
  formatWeekRange,
  nextPlannableWeekStart,
  toDateKey,
} from '@/lib/cycle';
import { PageHeader, Section, EmptyState, PhaseBadge, Alert } from '@/components/ui';
import { ActionForm } from '@/components/action-form';

import { createCycle } from './actions';

export const dynamic = 'force-dynamic';

export default async function CyclesPage() {
  await requireCapability('menu:plan');

  const cycles = await prisma.menuCycle.findMany({
    orderBy: { serviceWeekStart: 'desc' },
    take: 30,
    include: {
      days: { include: { _count: { select: { items: true } } } },
      _count: { select: { orders: true } },
    },
  });

  const suggested = nextPlannableWeekStart();
  const suggestedKey = toDateKey(suggested);
  const alreadyPlanned = cycles.some((c) => toDateKey(c.serviceWeekStart) === suggestedKey);

  const paidTotals = await prisma.order.groupBy({
    by: ['cycleId'],
    where: { status: 'PAID' },
    _sum: { netSen: true, subsidySen: true },
    _count: { _all: true },
  });
  const paidByCycle = new Map(paidTotals.map((t) => [t.cycleId, t]));

  return (
    <>
      <PageHeader
        title="Weekly menus"
        subtitle="Plan two weeks ahead, publish, then let staff order until the Wednesday cutoff."
      />

      {!alreadyPlanned ? (
        <div className="mb-6">
          <Alert tone="warning">
            <strong>{formatWeekRange(suggested)}</strong> has no menu yet. Create it now so it can be
            published on schedule at the start of next week.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Section title="Cycles" description="Most recent service weeks first">
          {cycles.length === 0 ? (
            <EmptyState title="No weekly menus yet" hint="Create the first one using the form on the right." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service week</th>
                    <th>Status</th>
                    <th className="num">Dishes</th>
                    <th className="num">Paid orders</th>
                    <th className="num">Staff pays</th>
                    <th className="num">Company pays</th>
                    <th>Cutoff</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => {
                    const phase = cyclePhase(c);
                    const items = c.days.reduce((n, d) => n + d._count.items, 0);
                    const totals = paidByCycle.get(c.id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link
                            href={`/admin/cycles/${c.id}`}
                            className="font-medium text-slate-900 hover:text-brand-700"
                          >
                            {formatWeekRange(c.serviceWeekStart)}
                          </Link>
                          {c.title ? <div className="text-xs text-slate-500">{c.title}</div> : null}
                        </td>
                        <td>
                          <PhaseBadge phase={phase} label={CYCLE_PHASE_LABEL[phase]} />
                        </td>
                        <td className="num text-slate-600">{items}</td>
                        <td className="num text-slate-600">{totals?._count._all ?? 0}</td>
                        <td className="num text-slate-900">{formatSen(totals?._sum.netSen ?? 0)}</td>
                        <td className="num text-emerald-700">{formatSen(totals?._sum.subsidySen ?? 0)}</td>
                        <td className="text-xs text-slate-500">{formatDateTime(c.orderCutoffAt)}</td>
                        <td>
                          <div className="flex justify-end">
                            <Link href={`/admin/cycles/${c.id}`} className="btn-secondary btn-sm">
                              Open
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Plan a new week">
          <div className="p-5">
            <ActionForm action={createCycle} submitLabel="Create draft" className="space-y-3">
              <div>
                <label className="label" htmlFor="weekOf">
                  Service week
                </label>
                <input
                  id="weekOf"
                  name="weekOf"
                  type="date"
                  required
                  defaultValue={suggestedKey}
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Any date in the week the food is served — it snaps to that Monday. Mon–Fri days are
                  created automatically.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="title">
                  Title (optional)
                </label>
                <input id="title" name="title" className="input" placeholder="Merdeka week specials" />
              </div>
            </ActionForm>

            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <p className="mb-1 font-semibold text-slate-700">How the schedule works</p>
              <p>
                Draft this week → publish on Monday of next week → staff order until{' '}
                <strong>Wednesday 5:00 pm</strong> → food served the week after.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
