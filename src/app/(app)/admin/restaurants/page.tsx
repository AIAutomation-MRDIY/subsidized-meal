import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { InlineSubmit } from '@/components/action-form';

import { deleteRestaurant, toggleRestaurantActive } from './actions';
import { AddRestaurantButton, EditRestaurantDialog } from './forms';

export const dynamic = 'force-dynamic';

export default async function RestaurantsPage() {
  await requireCapability('catalogue:manage');

  const restaurants = await prisma.restaurant.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { dishes: true } } },
  });

  return (
    <>
      <PageHeader
        title="Restaurants"
        subtitle="Vendors that supply the weekly staff menu."
        action={<AddRestaurantButton />}
      />

      <Section title="All restaurants" description={`${restaurants.length} total`}>
        {restaurants.length === 0 ? (
          <EmptyState
            title="No restaurants yet"
            hint="Add your first vendor, then create dishes for it."
            action={<AddRestaurantButton />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cuisine</th>
                  <th>Contact</th>
                  <th className="num">Dishes</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium text-slate-900">{r.name}</div>
                      {r.description ? (
                        <div className="text-xs text-slate-500">{r.description}</div>
                      ) : null}
                    </td>
                    <td className="text-slate-600">{r.cuisine ?? '—'}</td>
                    <td className="text-slate-600">
                      {r.contactName ?? '—'}
                      {r.contactPhone ? (
                        <div className="text-xs text-slate-400">{r.contactPhone}</div>
                      ) : null}
                    </td>
                    <td className="num text-slate-600">{r._count.dishes}</td>
                    <td>
                      <span
                        className={`badge ${
                          r.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <EditRestaurantDialog restaurant={r} />
                        <form action={toggleRestaurantActive}>
                          <input type="hidden" name="id" value={r.id} />
                          <InlineSubmit label={r.active ? 'Disable' : 'Enable'} />
                        </form>
                        <form action={deleteRestaurant}>
                          <input type="hidden" name="id" value={r.id} />
                          <InlineSubmit
                            label="Delete"
                            variant="danger"
                            confirm={`Delete ${r.name}? If it has order history it will be deactivated instead.`}
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
