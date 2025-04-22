"use client";
import Navbar from './Navbar';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children } : { children: React.ReactNode }) {

  const isSpace = usePathname().includes('space');

  return (
    <div className={`"min-h-screen bg-gray-100 overflow-x-hidden " + ${isSpace ? 'flex' : ''} `}>
      <Navbar />
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
