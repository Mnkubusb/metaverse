"use client";
import Navbar from './Navbar';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children } : { children: React.ReactNode }) {

  const isSpace = usePathname().includes('space');
  const isMap = usePathname().includes('maps');

  return (
    <div className={`"min-h-screen overflow-x-hidden " + ${isSpace || isMap ? 'flex' : ''} `}>
        <Navbar />
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
