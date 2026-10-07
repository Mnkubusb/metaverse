"use client";
import Navbar from './Navbar';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // spaces and the map editor sit beside a slim icon rail; other pages go under a top bar
  const rail = pathname.startsWith('/space/') || pathname.includes('maps');

  return (
    <div className={rail ? 'flex min-h-dvh overflow-hidden' : 'min-h-dvh overflow-x-hidden'}>
      <Navbar />
      <main className="w-full min-w-0">
        {children}
      </main>
    </div>
  );
}
