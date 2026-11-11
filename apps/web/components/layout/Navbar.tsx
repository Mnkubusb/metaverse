"use client";
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
      <nav aria-label="Main" className="hidden h-dvh w-14 shrink-0 flex-col items-center gap-1.5 bg-[#0e1813] py-4 text-plate/70 shadow-[1px_0_0_rgb(255_255_255/0.06)] md:flex">
        <Link href="/" aria-label="Home" title="Home"
          className="mb-5 flex size-10 items-center justify-center rounded-lg bg-sign font-pixel text-xl leading-none text-plate shadow-[inset_0_0_0_2px_#2b7458,0_3px_0_#0f3226] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6ee7b7]">
          G
        </Link>
        {items.map((it) => (
          <Link key={it.href} href={it.href} title={it.label} aria-label={it.label}
            className={cn('hud-btn flex size-10 items-center justify-center hover:text-plate',
              active(it.href) && 'bg-white/10 text-plate')}>
            {it.icon}
          </Link>
        ))}
        {isAuthenticated && (
          <button type="button" onClick={logout} title="Log out" aria-label="Log out"
            className="hud-btn mt-auto flex size-10 items-center justify-center hover:text-plate">
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
          className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-foreground/75 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active(it.href) && 'bg-accent text-sign-deep')}>
          {it.icon}{it.label}
        </Link>
      ))}
      <button type="button" onClick={logout}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-foreground/75 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:ml-auto">
        <LogOut className="size-4" />Log out
      </button>
    </>
  ) : (
    <>
      <Link href="/login" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-foreground/75 transition-colors hover:bg-accent hover:text-foreground md:ml-auto">
        <LogIn className="size-4" />Log in
      </Link>
      <Link href="/signup" className="flex items-center gap-2 rounded-lg bg-sign px-3 py-2 text-sm font-bold text-plate shadow-[0_2px_0_#0f3226] transition-colors hover:bg-sign-deep">
        <UserPlus className="size-4" />Sign up
      </Link>
    </>
  );

  return (
    <nav aria-label="Main" className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="sign-plate shrink-0 px-5 py-1.5 font-pixel text-lg leading-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring">
          GEC Bilaspur campus
        </Link>
        <div className="hidden flex-1 items-center gap-1 md:flex">{links}</div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="nav-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="ml-auto flex size-10 items-center justify-center rounded-lg text-foreground/80 hover:bg-accent md:hidden">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div id="nav-menu" className="absolute inset-x-0 top-16 grid gap-1 border-b border-border bg-background p-3 shadow-[0_12px_24px_-12px_rgb(0_0_0/0.25)] md:hidden">
          {links}
        </div>
      )}
    </nav>
  );
}
