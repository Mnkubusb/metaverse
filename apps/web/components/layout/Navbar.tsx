"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Compass, LayoutDashboard, LogIn, LogOut, Menu, Shield, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../contexts/authContext';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function useNavItems(): NavItem[] {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return [];
  return [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4" /> },
    { href: '/spaces', label: 'Spaces', icon: <Building2 className="size-4" /> },
    { href: '/explore', label: 'Explore', icon: <Compass className="size-4" /> },
    ...(isAdmin ? [{ href: '/admin/dashboard', label: 'Admin', icon: <Shield className="size-4" /> }] : []),
  ];
}

/**
 * Two layouts:
 * - pages: a top bar; on phones the links fold into a menu button
 * - inside a space or the map editor: a slim icon rail on the left, hidden on phones
 *   (the space HUD has its own "leave" button there, so the map gets the whole screen)
 */
export default function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuth();
  const items = useNavItems();
  const [open, setOpen] = useState(false);
  const rail = pathname.startsWith('/space/') || pathname.includes('maps');

  // close the phone menu after navigating
  useEffect(() => { setOpen(false); }, [pathname]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + '/');

  if (rail) {
    return (
      <nav aria-label="Main" className="hidden h-dvh w-14 shrink-0 flex-col items-center gap-2 bg-white py-4 shadow-lg md:flex">
        <Link href="/" aria-label="Home" className="mb-6">
          <img src="/logoipsum-371.svg" alt="" className="size-10" />
        </Link>
        {items.map((it) => (
          <Link key={it.href} href={it.href} title={it.label} aria-label={it.label}
            className={cn('flex size-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100',
              active(it.href) && 'bg-gray-100 text-gray-900')}>
            {it.icon}
          </Link>
        ))}
        {isAuthenticated && (
          <button type="button" onClick={logout} title="Log out" aria-label="Log out"
            className="mt-auto flex size-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
            <LogOut className="size-4" />
          </button>
        )}
      </nav>
    );
  }

  const links = isAuthenticated ? (
    <>
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={active(it.href) ? 'page' : undefined}
          className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100',
            active(it.href) && 'bg-gray-100 text-gray-900')}>
          {it.icon}{it.label}
        </Link>
      ))}
      <button type="button" onClick={logout}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 md:ml-auto">
        <LogOut className="size-4" />Log out
      </button>
    </>
  ) : (
    <>
      <Link href="/login" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 md:ml-auto">
        <LogIn className="size-4" />Log in
      </Link>
      <Link href="/signup" className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        <UserPlus className="size-4" />Sign up
      </Link>
    </>
  );

  return (
    <nav aria-label="Main" className="relative z-40 bg-white shadow-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <img src="/logoipsum-371.svg" alt="" className="size-9" /> Metaverse
        </Link>
        <div className="hidden flex-1 items-center gap-1 md:flex">{links}</div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="nav-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="ml-auto flex size-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div id="nav-menu" className="absolute inset-x-0 top-16 grid gap-1 border-t border-gray-100 bg-white p-3 shadow-lg md:hidden">
          {links}
        </div>
      )}
    </nav>
  );
}
