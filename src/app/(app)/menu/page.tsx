import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/session';
import { decodeTags } from '@/lib/db-compat';
import { employeePriceFor } from '@/lib/subsidy';
import { formatDate, formatDateTime, formatWeekRange, timeUntil, toDateKey } from '@/lib/cycle';
import { remainingCapacityMap } from '@/lib/orders';
import { PageHeader, EmptyState, Alert } from '@/components/ui';
import type { DayTab } from '@/components/day-tabs';

import { MenuOrdering, type CartLine, type MenuDish } from './menu-ordering';

export const dynamic = 'force-dynamic';

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireCapability('order:place');
  const { day: requestedDay } = await searchParams;
  const now = new Date();

  // Cycle only - the dishes are fetched per selected day further down.
  const cycle = await prisma.menuCycle.findFirst({
    where: { status: 'PUBLISHED', orderOpenAt: { lte: now }, orderCutoffAt: { gt: now } },
    orderBy: { serviceWeekStart: 'asc' },
  });

  if (!cycle) {
    const upcoming = await prisma.menuCycle.findFirst({
      where: { status: 'PUBLISHED', orderOpenAt: { gt: now } },
      orderBy: { serviceWeekStart: 'asc' },
    });

    return (
      <>
        <PageHeader title="Next week's menu" />
        <EmptyState
          title="Ordering is closed right now"
          hint={
            upcoming
              ? `The menu for ${formatWeekRange(upcoming.serviceWeekStart)} opens on ${formatDateTime(
                  upcoming.orderOpenAt,
                )}.`
              : 'Ordering opens on Monday and closes Wednesday at 5:00 pm for the following week.'
          }
          action={
            <Link href="/orders" className="btn-secondary">
              View my past orders
            </Link>
          }
        />
      </>
    );
  }

  // The cart is created on first add, not on first view, so browsing does
  // not litter the table with empty orders.
  const order = await prisma.order.findUnique({
    where: { userId_cycleId: { userId: user.id, cycleId: cycle.id } },
    include: { items: { orderBy: [{ serviceDate: 'asc' }, { dishName: 'asc' }] } },
  });

  const submitted = Boolean(order && order.status !== 'CART');

  // Day tabs: dates and per-day dish counts only - not the dishes themselves.
  const days = await prisma.menuDay.findMany({
    where: { cycleId: cycle.id },
    orderBy: { serviceDate: 'asc' },
    select: { id: true, serviceDate: true, _count: { select: { items: true } } },
  });

  const header = (
    <PageHeader
      title={`Menu for ${formatWeekRange(cycle.serviceWeekStart)}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {submitted ? (
            <span className="badge bg-emerald-100 text-emerald-800">Order placed</span>
          ) : (
            <>
              <span className="badge bg-emerald-100 text-emerald-800">Ordering open</span>
              <span>
                Closes {formatDateTime(cycle.orderCutoffAt)} ·{' '}
                <span className="font-medium text-slate-700">{timeUntil(cycle.orderCutoffAt)}</span>
              </span>
            </>
          )}
        </span>
      }
      action={
        <Link href="/orders" className="btn-secondary">
          My orders
        </Link>
      }
    />
  );

  if (days.length === 0) {
    return (
      <>
        {header}
        <EmptyState title="No days have been set up for this week yet" />
      </>
    );
  }

  const orderItems = order?.items ?? [];
  const chosenDays = new Set(orderItems.map((item) => toDateKey(item.serviceDate)));
  const chosenMenuItemIds = new Set(orderItems.map((item) => item.menuItemId));

  // Honour ?day= when it names a real day, otherwise open the first day that
  // has dishes - or, once submitted, the first day they actually ordered.
  const fallback =
    (submitted ? days.find((d) => chosenDays.has(toDateKey(d.serviceDate))) : undefined) ??
    days.find((d) => d._count.items > 0) ??
    days[0];
  const activeDay = days.find((d) => toDateKey(d.serviceDate) === requestedDay) ?? fallback;
  const activeDayKey = toDateKey(activeDay.serviceDate);

  const tabs: DayTab[] = days.map((d) => ({
    key: toDateKey(d.serviceDate),
    label: formatDate(d.serviceDate, 'weekday').slice(0, 3),
    sublabel: formatDate(d.serviceDate),
    check: chosenDays.has(toDateKey(d.serviceDate)),
    muted: d._count.items === 0,
  }));

  // ---- The only query that loads dishes, and only for the open tab. ----
  const menuItems = await prisma.menuItem.findMany({
    where: { menuDayId: activeDay.id },
    orderBy: { sortOrder: 'asc' },
    include: { dish: { include: { restaurant: { select: { name: true } } } } },
  });

  // Stock only matters while they can still change their mind.
  const remaining = submitted
    ? new Map<string, number | null>()
    : await remainingCapacityMap(
        menuItems.map((i) => ({ id: i.id, capacity: i.capacity })),
        order?.id,
      );

  // Employees see their own price, never the list price or the company's
  // contribution. Exact per dish because it is one meal per service day.
  const rules = await prisma.subsidyRule.findMany({ where: { active: true } });

  const dishes: MenuDish[] = menuItems.map((item) => ({
    menuItemId: item.id,
    dishName: item.dish.name,
    restaurantName: item.dish.restaurant.name,
    description: item.dish.description,
    tags: decodeTags(item.dish.tags),
    priceSen: employeePriceFor(item.priceSen, activeDay.serviceDate, rules, user.department),
    remaining: remaining.get(item.id) ?? null,
    chosen: chosenMenuItemIds.has(item.id),
  }));

  const cartLines: CartLine[] = orderItems.map((item) => ({
    id: item.id,
    dayKey: toDateKey(item.serviceDate),
    dayLabel: `${formatDate(item.serviceDate, 'weekday')} · ${formatDate(item.serviceDate)}`,
    dishName: item.dishName,
    netSen: item.netSen,
  }));

  return (
    <>
      {header}

      {submitted && order?.status === 'AWAITING_PAYMENT' ? (
        <div className="mb-4">
          <Alert tone="warning">
            We are waiting for your payment to be confirmed. Refresh shortly, or open the receipt to
            continue paying.
          </Alert>
        </div>
      ) : null}

      <MenuOrdering
        cycleId={cycle.id}
        tabs={tabs}
        activeDay={activeDayKey}
        dayHeading={formatDate(activeDay.serviceDate, 'full')}
        dishes={dishes}
        cartLines={cartLines}
        notes={cycle.notes}
        totalSen={order?.netSen ?? 0}
        readOnly={submitted}
        orderReference={order?.reference}
        orderStatus={order?.status}
      />
    </>
  );
}
