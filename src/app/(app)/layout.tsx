import Link from 'next/link';

import { requireUser } from '@/lib/session';
import { can, ROLE_LABEL } from '@/lib/rbac';
import { MobileNav, SideNav, type NavGroup } from '@/components/nav';
import { logoutAction } from '@/app/login/actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const groups: NavGroup[] = [];

  if (can(user.role, 'order:place')) {
    groups.push({
      heading: 'Order',
      items: [
        { href: '/menu', label: "Next week's menu" },
        { href: '/orders', label: 'My orders' },
      ],
    });
  }

  if (can(user.role, 'menu:plan')) {
    groups.push({
      heading: 'Administration',
      items: [
        { href: '/admin/cycles', label: 'Weekly menus' },
        { href: '/admin/restaurants', label: 'Restaurants' },
        { href: '/admin/dishes', label: 'Dishes & prices' },
        { href: '/admin/subsidies', label: 'Subsidies' },
        { href: '/admin/users', label: 'Users & roles' },
      ],
    });
  }

  const insights: NavGroup = { heading: 'Insights', items: [] };
  if (can(user.role, 'analytics:view')) insights.items.push({ href: '/analytics', label: 'Analytics' });
  if (can(user.role, 'finance:view')) insights.items.push({ href: '/finance', label: 'Finance' });
  if (can(user.role, 'kitchen:view')) insights.items.push({ href: '/kitchen', label: 'Kitchen counts' });
  if (insights.items.length) groups.push(insights);

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              MR
            </span>
            <span className="text-sm font-semibold text-slate-900">Food Ordering</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">
                {ROLE_LABEL[user.role]}
                {user.department ? ` · ${user.department}` : ''}
              </div>
            </div>
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
            >
              {initials}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <MobileNav groups={groups} />
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <SideNav groups={groups} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
