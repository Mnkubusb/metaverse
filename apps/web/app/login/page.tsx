"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/authContext';
import { safeNext } from '@/lib/next';
import AuthShell, { Field, FormError, SubmitButton } from '@/components/auth/AuthShell';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, user, loading } = useAuth();
  const router = useRouter();
  // carries ?next= between login and signup; read after mount to keep server and client HTML identical
  const [search, setSearch] = useState('');
  useEffect(() => setSearch(window.location.search), []);
  const registered = new URLSearchParams(search).get('registered') === 'true';

  // e.g. an invite link opened while logged out: come back to it after signing in
  const next = () => safeNext(new URLSearchParams(window.location.search).get('next'));

  useEffect(() => {
    if (!loading && user) {
      router.push(next());
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Enter your username and password.');
      return;
    }

    setBusy(true);
    const result = await login(username, password);
    setBusy(false);

    if (result.success) {
      router.push(next());
    } else {
      setError(result.error || 'Those details didn’t match an account. Check your username and password.');
    }
  };

  return (
    <AuthShell title="Log in">
      <p className="mt-2 text-asphalt-soft">
        {registered ? 'Account created. Log in to pick your character.' : 'Pick up where you left off on campus.'}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {error && <FormError>{error}</FormError>}
        <Field
          id="username"
          label="Username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={!!error && !username}
          required
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error && !password}
          required
        />
        <SubmitButton busy={busy} busyLabel="Logging in…">Log in</SubmitButton>
      </form>

      <p className="mt-8 text-asphalt-soft">
        New here?{' '}
        <Link href={`/signup${search}`} className="font-bold text-sign underline decoration-2 underline-offset-4 hover:text-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sign">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
};

export default Login;
