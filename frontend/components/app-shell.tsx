'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  CalendarDays,
  CloudSun,
  Database,
  FlaskConical,
  FolderKanban,
  Home,
  LockKeyhole,
  Map,
  Menu,
  Settings,
  ShieldAlert,
} from 'lucide-react';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const secondaryNavigation = [
  { href: '/app/data-sources', label: 'Data Sources', icon: Database },
  { href: '/app/settings', label: 'Settings', icon: Settings },
  { href: '/app/project', label: 'Project & Architecture', icon: FolderKanban },
];

function Navigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const farmId = pathname.match(/^\/app\/farms\/([^/]+)/)?.[1];
  const farmBase = farmId ? `/app/farms/${farmId}` : null;
  const primaryNavigation = [
    { href: '/app', label: 'Overview', icon: Home, available: true },
    { href: farmBase ? `${farmBase}/twin` : '#', label: 'Farm Digital Twin', icon: Map, available: Boolean(farmBase) },
    { href: farmBase ? `${farmBase}/crops` : '#', label: 'Crop Simulator', icon: FlaskConical, available: Boolean(farmBase) },
    { href: farmBase ? `${farmBase}/annual-plan` : '#', label: 'Annual Crop Plan', icon: CalendarDays, available: Boolean(farmBase) },
    { href: farmBase ? `${farmBase}/risks` : '#', label: 'Disaster Center', icon: ShieldAlert, available: Boolean(farmBase) },
    { href: farmBase ? `${farmBase}/twin#climate` : '#', label: 'Climate', icon: CloudSun, available: Boolean(farmBase) },
  ];
  return (
    <nav className="app-navigation" aria-label="Workspace navigation">
      <div className="nav-group">
        <p className="nav-label">Workspace</p>
        {primaryNavigation.map(({ href, label, icon: Icon, available }) => {
          const active =
            href === '/app'
              ? pathname === href
              : pathname.startsWith(href) ||
                (href.endsWith('annual-plan') &&
                  pathname.includes('/annual-plan')) ||
                (href.endsWith('disaster-center') &&
                  pathname.includes('/risks')) ||
                (href.endsWith('crop-simulator') &&
                  pathname.includes('/crops'));
          if (!available) {
            return (
              <span
                key={label}
                className="nav-item nav-item-unavailable"
                aria-disabled="true"
              >
                <Icon aria-hidden="true" />
                <span className="nav-item-text">
                  {label}
                  <small className="nav-coming-soon">Select a farm first</small>
                </span>
                <LockKeyhole className="nav-lock" aria-label="Select a farm first" />
              </span>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              className="nav-item"
              data-active={active || undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="nav-group nav-group-secondary">
        <p className="nav-label">System</p>
        {secondaryNavigation.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              className="nav-item"
              data-active={active || undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>
        <Navigation />
        <div className="sidebar-foot">
          <div className="sidebar-foot-brand">
            <p>Better decisions</p>
            <p>Healthier farms</p>
            <p>Greener Kenya</p>
          </div>
        </div>
      </aside>

      <div className="app-frame">
        <header className="app-header">
          <div className="mobile-brand">
            <Brand />
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="app-menu-button"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="mobile-sheet">
              <SheetHeader>
                <SheetTitle>
                  <Brand />
                </SheetTitle>
                <SheetDescription>Farm planning workspace</SheetDescription>
              </SheetHeader>
              <Navigation close={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
