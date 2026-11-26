'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import {
  CalendarDaysIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  TagIcon,
  DocumentTextIcon,
  BanknotesIcon,
  UsersIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  Cog6ToothIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  TruckIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';

import { ScrollFadeRow } from '@/components/scroll-fade-row';

export type NavItem = { href: string; label: string; badge?: boolean };
export type NavGroup = { heading: string; items: NavItem[] };

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ROUTE_ICONS: Record<string, IconComponent> = {
  '/menu':                   CalendarDaysIcon,
  '/my-meals':               ClipboardDocumentListIcon,
  '/orders':                 ShoppingBagIcon,
  '/admin/cycles':           CalendarIcon,
  '/admin/restaurants':      BuildingStorefrontIcon,
  '/admin/delivery-sites':   MapPinIcon,
  '/admin/dishes':           TagIcon,
  '/admin/invoices':         DocumentTextIcon,
  '/admin/subsidies':        BanknotesIcon,
  '/admin/users':            UsersIcon,
  '/admin/bulk-refund':      ArrowPathIcon,
  '/admin/companies':        BuildingOffice2Icon,
  '/admin/settings':         Cog6ToothIcon,
  '/admin/audit':            ListBulletIcon,
  '/analytics':              ChartBarIcon,
  '/finance':                CurrencyDollarIcon,
  '/kitchen':                ClipboardDocumentCheckIcon,
  '/receipt':                CheckCircleIcon,
  '/reception':              TruckIcon,
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const isActive = useIsActive();

  return (
    <nav className="space-y-5">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {group.heading}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = ROUTE_ICONS[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center gap-2.5 rounded-lg py-2 pl-6 pr-3 text-sm transition-colors ${
                      active
                        ? 'bg-brand-50 font-medium text-brand-800'
                        : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                    }`}
                  >
                    {active ? (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-600" />
                    ) : null}
                    {Icon ? (
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                    ) : null}
                    <span className="truncate">{item.label}</span>
                    {item.badge && !active ? (
                      <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Horizontally scrolling nav for narrow screens. Employees order lunch on
 * their phones, so the sidebar cannot simply disappear below `lg`.
 */
export function MobileNav({ groups }: { groups: NavGroup[] }) {
  const isActive = useIsActive();
  const items = groups.flatMap((g) => g.items);

  if (items.length <= 1) return null;

  return (
    <nav aria-label="Sections" className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
      <ScrollFadeRow innerClassName="gap-1" fadeColorClassName="from-white">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = ROUTE_ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-brand-600 font-medium text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
              {item.label}
              {item.badge && !active ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              ) : null}
            </Link>
          );
        })}
      </ScrollFadeRow>
    </nav>
  );
}
