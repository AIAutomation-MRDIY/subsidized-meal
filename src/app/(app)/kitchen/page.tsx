import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { CYCLE_PHASE_LABEL, cyclePhase, formatDate, formatWeekRange, toDateKey } from '@/lib/cycle';
import { kitchenSheet } from '@/lib/reporting';
import { PageHeader, Section, EmptyState, PhaseBadge, Alert, Stat } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  await requireCapability('kitchen:view');
  const params = await searchParams;

  const cycles = await prisma.menuCycle.findMany({
    where: { status: { in: ['PUBLISHED', 'CLOSED', 'FULFILLED'] } },
    orderBy: { serviceWeekStart: 'desc' },
    take: 20,
    select: { id: true, serviceWeekStart: true, status: true, orderOpenAt: true, orderCutoffAt: true },
  });

  if (cycles.length === 0) {
    return (
      <>
        <PageHeader title="Kitchen counts" />
        <EmptyState
          title="No published weeks yet"
          hint="Counts appear once a weekly menu is published and staff start ordering."
        />
      </>
    );
  }

  const selected = cycles.find((c) => c.id === params.cycle) ?? cycles[0];
  const phase = cyclePhase(selected);
  const sheet = await kitchenSheet(selected.id);

  const byRestaurant = new Map<string, typeof sheet>();
  for (const row of sheet) {
    const bucket = byRestaurant.get(row.restaurantName);
    if (bucket) bucket.push(row);
    else byRestaurant.set(row.restaurantName, [row]);
  }

  const totalPortions = sheet.reduce((s, r) => s + r.quantity, 0);

  return (
    <>
      <PageHeader
        title="Kitchen counts"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={phase} label={CYCLE_PHASE_LABEL[phase]} />
            <span>{formatWeekRange(selected.serviceWeekStart)}</span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              <select name="cycle" defaultValue={selected.id} className="input !w-56 !py-1 text-xs">
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatWeekRange(c.serviceWeekStart)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary btn-sm">
                Show
              </button>
            </form>
            <a href={`/api/exports/kitchen?cycle=${selected.id}`} className="btn-secondary btn-sm">
              Export CSV
            </a>
          </div>
        }
      />

      {phase === 'OPEN' ? (
        <div className="mb-6">
          <Alert tone="warning">
            Ordering is still open for this week — these counts will keep changing until the cutoff.
            Send final numbers to restaurants after ordering closes.
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total portions" value={totalPortions.toLocaleString()} />
        <Stat label="Restaurants" value={byRestaurant.size} />
        <Stat label="Distinct dishes" value={new Set(sheet.map((r) => r.dishName)).size} />
      </div>

      {sheet.length === 0 ? (
        <EmptyState title="Nothing ordered yet for this week" />
      ) : (
        <div className="grid gap-6">
          {[...byRestaurant.entries()].map(([restaurant, rows]) => {
            const byDate = new Map<string, typeof rows>();
            for (const r of rows) {
              const key = toDateKey(r.serviceDate);
              const bucket = byDate.get(key);
              if (bucket) bucket.push(r);
              else byDate.set(key, [r]);
            }
            const restaurantTotal = rows.reduce((s, r) => s + r.quantity, 0);

            return (
              <Section
                key={restaurant}
                title={restaurant}
                description={`${restaurantTotal} portion(s) across the week`}
              >
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Service date</th>
                        <th>Dish</th>
                        <th className="num">Portions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...byDate.entries()].map(([dateKey, dayRows]) =>
                        dayRows.map((r, i) => (
                          <tr key={`${dateKey}-${r.dishName}`}>
                            <td className={i === 0 ? 'font-medium text-slate-900' : 'text-slate-400'}>
                              {i === 0
                                ? `${formatDate(r.serviceDate, 'weekday')} · ${formatDate(r.serviceDate, 'long')}`
                                : ''}
                            </td>
                            <td className="text-slate-700">{r.dishName}</td>
                            <td className="num font-medium text-slate-900">{r.quantity}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>
            );
          })}
        </div>
      )}
    </>
  );
}
