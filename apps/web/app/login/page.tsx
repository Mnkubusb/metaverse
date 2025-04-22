"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/authContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if already logged in
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e : React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    const result = await login(username, password);
    
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Failed to sign in');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="p-8 rounded shadow-md w-full max-w-md bg-white text-black flex justify-center items-center flex-col gap-4">
        <h1 className="text-2xl font-bold mb-6 text-center ">Sign In</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4 flex flex-col gap-2">
            <label className="block text-gray-700 mb-2" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 mt-4"
          >
            Sign In
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-500 hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;