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

const primaryNavigation = [
  { href: '/app', label: 'Overview', icon: Home, available: true },
  {
    href: '/app/tools/digital-twin',
    label: 'Farm Digital Twin',
    icon: Map,
    available: false,
  },
  {
    href: '/app/tools/crop-simulator',
    label: 'Crop Simulator',
    icon: FlaskConical,
    available: true,
  },
  {
    href: '/app/tools/annual-plan',
    label: 'Annual Crop Plan',
    icon: CalendarDays,
    available: true,
  },
  {
    href: '/app/tools/disaster-center',
    label: 'Climate Risk Center',
    icon: ShieldAlert,
    available: true,
  },
  {
    href: '/app/tools/climate',
    label: 'Climate',
    icon: CloudSun,
    available: false,
  },
];

const secondaryNavigation = [
  { href: '/app/data-sources', label: 'Data Sources', icon: Database },
  { href: '/app/settings', label: 'Settings', icon: Settings },
  { href: '/app/project', label: 'Project & Architecture', icon: FolderKanban },
];

function Navigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
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
              {!available && (
                <LockKeyhole className="nav-lock" aria-label="Farm required" />
              )}
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
          <span className="demo-badge">
            <span aria-hidden="true" /> Preview · non-live
          </span>
          <p>
            Planner and risk outputs are demonstration indices until live
            evidence is connected.
          </p>
        </div>
      </aside>

      <div className="app-frame">
        <header className="app-header">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="workspace-context">
            <p>FarmTwin workspace</p>
            <span>No farm selected</span>
          </div>
          <span className="demo-badge app-demo-badge">
            <span aria-hidden="true" /> Demonstration mode
          </span>
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
