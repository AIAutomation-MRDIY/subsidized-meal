import { requireCapability } from '@/lib/session';
import { formatSen } from '@/lib/money';
import {
  demandByWeekday,
  departmentBreakdown,
  participation,
  restaurantShare,
  topDishes,
  trailingWeeks,
  weeklyTotals,
} from '@/lib/reporting';
import { PageHeader, Section, Stat, EmptyState } from '@/components/ui';

import { RestaurantShareChart, SpendChart, WeekdayChart, WeeklyDemandChart } from './charts';

export const dynamic = 'force-dynamic';

const RANGES = [4, 8, 12, 26] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ weeks?: string }>;
}) {
  await requireCapability('analytics:view');
  const params = await searchParams;

  const requested = Number.parseInt(params.weeks ?? '', 10);
  const weeks = (RANGES as readonly number[]).includes(requested) ? requested : 12;
  const window = trailingWeeks(weeks);

  const [weekly, dishes, restaurants, weekday, departments, take] = await Promise.all([
    weeklyTotals(window),
    topDishes(window, 10),
    restaurantShare(window),
    demandByWeekday(window),
    departmentBreakdown(window),
    participation(window),
  ]);

  const totalMeals = weekly.reduce((s, w) => s + w.meals, 0);
  const totalOrders = weekly.reduce((s, w) => s + w.orders, 0);
  const totalGross = weekly.reduce((s, w) => s + w.grossSen, 0);
  const weeksWithData = weekly.filter((w) => w.orders > 0).length;

  const rangeSwitcher = (
    <form method="get" className="flex items-center gap-2">
      <label htmlFor="weeks" className="text-xs text-slate-500">
        Range
      </label>
      <select id="weeks" name="weeks" defaultValue={String(weeks)} className="input !w-32 !py-1 text-xs">
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

  if (totalOrders === 0) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Demand and participation across service weeks." action={rangeSwitcher} />
        <EmptyState
          title="No paid orders in this range"
          hint="Charts appear once staff have placed and paid for orders. Try a longer range."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Paid orders across the last ${weeks} service weeks.`}
        action={rangeSwitcher}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Meals served" value={totalMeals.toLocaleString()} hint={`${totalOrders} orders`} />
        <Stat
          label="Participation"
          value={`${Math.round(take.rate * 100)}%`}
          hint={`${take.ordered} of ${take.eligible} active staff`}
        />
        <Stat
          label="Avg meals / week"
          value={weeksWithData ? Math.round(totalMeals / weeksWithData).toLocaleString() : '0'}
          hint={`${weeksWithData} weeks with orders`}
        />
        <Stat
          label="Avg meal value"
          value={totalMeals ? formatSen(Math.round(totalGross / totalMeals)) : formatSen(0)}
          hint="gross, before subsidy"
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Section title="Demand by week" description="Meals and distinct orders per service week">
          <div className="p-4">
            <WeeklyDemandChart
              data={weekly.map((w) => ({ label: w.label.split(' - ')[0], meals: w.meals, orders: w.orders }))}
            />
          </div>
        </Section>

        <Section title="Who pays what" description="Staff contribution vs company subsidy, RM">
          <div className="p-4">
            <SpendChart
              data={weekly.map((w) => ({
                label: w.label.split(' - ')[0],
                staff: w.netSen,
                company: w.subsidySen,
              }))}
            />
          </div>
        </Section>

        <Section title="Demand by weekday" description="Which days staff actually eat in">
          <div className="p-4">
            <WeekdayChart data={weekday} />
          </div>
        </Section>

        <Section title="Restaurant share" description="By gross food value">
          <div className="p-4">
            <RestaurantShareChart data={restaurants.slice(0, 7)} />
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Most ordered dishes" description="Top 10 by portions">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Restaurant</th>
                  <th className="num">Portions</th>
                  <th className="num">Food value</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((d) => (
                  <tr key={`${d.restaurantName}-${d.dishName}`}>
                    <td className="font-medium text-slate-900">{d.dishName}</td>
                    <td className="text-slate-600">{d.restaurantName}</td>
                    <td className="num text-slate-900">{d.quantity}</td>
                    <td className="num text-slate-600">{formatSen(d.grossSen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="By department" description="Uptake and spend per department">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="num">People</th>
                  <th className="num">Orders</th>
                  <th className="num">Food value</th>
                  <th className="num">Subsidy</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.department}>
                    <td className="font-medium text-slate-900">{d.department}</td>
                    <td className="num text-slate-600">{d.people}</td>
                    <td className="num text-slate-600">{d.orders}</td>
                    <td className="num text-slate-900">{formatSen(d.grossSen)}</td>
                    <td className="num text-emerald-700">{formatSen(d.subsidySen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
