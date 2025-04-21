"use client"
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/authContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect based on authentication status
  React.useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex justify-center items-center h-screen bg-black">
      <div className="text-center flex justify-center items-center flex-col gap-2">
        <h1 className="text-4xl font-bold mb-6">Virtual Space Platform</h1>
        <p className="text-xl mb-8">Create and explore virtual spaces</p>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4">Loading...</p>
      </div>
    </div>
  );
}