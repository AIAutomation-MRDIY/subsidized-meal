import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { can } from '@/lib/rbac';
import { formatSen } from '@/lib/money';
import { formatWeekRange, formatDateTime } from '@/lib/cycle';
import { PageHeader, Section, EmptyState, StatusBadge, Stat } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await requireCapability('order:place');

  const orders = await prisma.order.findMany({
    where: { userId: user.id, status: { not: 'CART' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      cycle: { select: { serviceWeekStart: true } },
      _count: { select: { items: true } },
    },
  });

  const paid = orders.filter((o) => o.status === 'PAID');
  const spent = paid.reduce((s, o) => s + o.netSen, 0);

  // The company's contribution is not the employee's business - only roles
  // that already have finance access see it.
  const showSubsidy = can(user.role, 'finance:view');
  const saved = paid.reduce((s, o) => s + o.subsidySen, 0);

  return (
    <>
      <PageHeader
        title="My orders"
        subtitle="Every week you have ordered for."
        action={
          <Link href="/menu" className="btn-primary">
            Order for next week
          </Link>
        }
      />

      <div className={`mb-6 grid gap-4 ${showSubsidy ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Stat label="Orders placed" value={paid.length} />
        <Stat label="You have paid" value={formatSen(spent)} />
        {showSubsidy ? (
          <Stat label="Company covered" value={formatSen(saved)} tone="positive" />
        ) : null}
      </div>

      <Section title="History">
        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            hint="When a menu is open you can pick meals for each day of the following week."
            action={
              <Link href="/menu" className="btn-primary">
                Browse the menu
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Service week</th>
                  <th className="num">Meals</th>
                  {showSubsidy ? <th className="num">Food total</th> : null}
                  {showSubsidy ? <th className="num">Subsidy</th> : null}
                  <th className="num">You paid</th>
                  <th>Status</th>
                  <th>Placed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs text-slate-700">{o.reference}</td>
                    <td className="text-slate-900">{formatWeekRange(o.cycle.serviceWeekStart)}</td>
                    <td className="num text-slate-600">{o._count.items}</td>
                    {showSubsidy ? (
                      <td className="num text-slate-600">{formatSen(o.grossSen)}</td>
                    ) : null}
                    {showSubsidy ? (
                      <td className="num text-emerald-700">−{formatSen(o.subsidySen)}</td>
                    ) : null}
                    <td className="num font-medium text-slate-900">{formatSen(o.netSen)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="text-xs text-slate-500">
                      {o.submittedAt ? formatDateTime(o.submittedAt) : '—'}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Link href={`/orders/${o.reference}`} className="btn-secondary btn-sm">
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
