import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { containsInsensitive, decodeTags } from '@/lib/db-compat';
import { formatSen } from '@/lib/money';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { InlineSubmit } from '@/components/action-form';

import { deleteDish, toggleDishActive } from './actions';
import { AddDishButton, EditDishDialog } from './dish-form';

export const dynamic = 'force-dynamic';

export default async function DishesPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string; q?: string }>;
}) {
  await requireCapability('catalogue:manage');
  const params = await searchParams;

  const restaurants = await prisma.restaurant.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, active: true },
  });

  const dishes = await prisma.dish.findMany({
    where: {
      restaurantId: params.restaurant || undefined,
      name: params.q ? containsInsensitive(params.q) : undefined,
    },
    orderBy: [{ active: 'desc' }, { restaurant: { name: 'asc' } }, { name: 'asc' }],
    include: { restaurant: { select: { name: true, active: true } } },
  });

  // tags are a scalar list on Postgres and a delimited string on SQLite
  const rows = dishes.map((d) => ({ ...d, tags: decodeTags(d.tags) }));

  return (
    <>
      <PageHeader
        title="Dishes & prices"
        subtitle="The catalogue admins pick from when planning a week. Editing a price here never changes a menu that is already published."
        action={<AddDishButton restaurants={restaurants} />}
      />

      {restaurants.length === 0 ? (
        <EmptyState
          title="Add a restaurant first"
          hint="Dishes belong to a restaurant, so start there."
          action={
            <Link href="/admin/restaurants" className="btn-primary">
              Go to restaurants
            </Link>
          }
        />
      ) : (
        <Section
            title="Catalogue"
            description={`${rows.length} dish${rows.length === 1 ? '' : 'es'}`}
            action={
              <form method="get" className="flex gap-2">
                <select name="restaurant" defaultValue={params.restaurant ?? ''} className="input !w-44 !py-1 text-xs">
                  <option value="">All restaurants</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="Search dish"
                  className="input !w-36 !py-1 text-xs"
                />
                <button type="submit" className="btn-secondary btn-sm">
                  Filter
                </button>
              </form>
            }
          >
            {rows.length === 0 ? (
              <EmptyState title="No dishes match" hint="Try clearing the filters, or add a dish on the right." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dish</th>
                      <th>Restaurant</th>
                      <th>Category</th>
                      <th className="num">Price</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="font-medium text-slate-900">{d.name}</div>
                          {d.tags.length > 0 ? (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {d.tags.map((t) => (
                                <span key={t} className="badge bg-slate-100 text-slate-600">
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-slate-600">{d.restaurant.name}</td>
                        <td className="text-slate-600">{d.category ?? '—'}</td>
                        <td className="num font-medium text-slate-900">{formatSen(d.priceSen)}</td>
                        <td>
                          <span
                            className={`badge ${
                              d.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {d.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <EditDishDialog dish={d} restaurants={restaurants} />
                            <form action={toggleDishActive}>
                              <input type="hidden" name="id" value={d.id} />
                              <InlineSubmit label={d.active ? 'Disable' : 'Enable'} />
                            </form>
                            <form action={deleteDish}>
                              <input type="hidden" name="id" value={d.id} />
                              <InlineSubmit
                                label="Delete"
                                variant="danger"
                                confirm={`Delete ${d.name}? If it has ever been on a menu it will be deactivated instead.`}
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

      )}
    </>
  );
}
