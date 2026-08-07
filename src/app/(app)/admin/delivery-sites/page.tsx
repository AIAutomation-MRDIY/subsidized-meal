import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { InlineSubmit } from '@/components/action-form';

import { deleteDeliverySite, toggleDeliverySiteActive } from './actions';
import { AddDeliverySiteButton, EditDeliverySiteDialog } from './site-form';

export const dynamic = 'force-dynamic';

export default async function DeliverySitesPage() {
  await requireCapability('catalogue:manage');

  const sites = await prisma.deliverySite.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { orders: true } } },
  });

  return (
    <>
      <PageHeader
        title="Delivery sites"
        subtitle="Where an order's food gets sent - chosen per order at checkout."
        action={<AddDeliverySiteButton />}
      />

      <Section title="All delivery sites" description={`${sites.length} total`}>
        {sites.length === 0 ? (
          <EmptyState
            title="No delivery sites yet"
            hint="Add at least one site so employees can check out."
            action={<AddDeliverySiteButton />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Orders</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-900">{s.name}</td>
                    <td className="num text-slate-600">{s._count.orders}</td>
                    <td>
                      <span
                        className={`badge ${
                          s.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <EditDeliverySiteDialog site={s} />
                        <form action={toggleDeliverySiteActive}>
                          <input type="hidden" name="id" value={s.id} />
                          <InlineSubmit label={s.active ? 'Disable' : 'Enable'} />
                        </form>
                        <form action={deleteDeliverySite}>
                          <input type="hidden" name="id" value={s.id} />
                          <InlineSubmit
                            label="Delete"
                            variant="danger"
                            confirm={`Delete ${s.name}? If it has order history it will be deactivated instead.`}
                          />
                        </form>
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
