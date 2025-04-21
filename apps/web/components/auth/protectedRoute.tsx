"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/authContext';

export default function ProtectedRoute({ children, adminOnly = false } : { children: React.ReactNode, adminOnly?: boolean }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (adminOnly && !isAdmin) {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, isAdmin, loading, router, adminOnly]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated || (adminOnly && !isAdmin)) {
    return null;
  }

  return children;
}