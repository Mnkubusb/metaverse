"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/authContext';
import AuthShell, { Field, FormError, SubmitButton } from '@/components/auth/AuthShell';

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<'username' | 'password' | 'confirmPassword' | null>(null);
  const [busy, setBusy] = useState(false);
  const { signup, user, loading } = useAuth();
  const router = useRouter();
  // carries ?next= between login and signup; read after mount to keep server and client HTML identical
  const [search, setSearch] = useState('');
  useEffect(() => setSearch(window.location.search), []);

  useEffect(() => {
    // Redirect if already logged in
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const fail = (field: typeof invalid, message: string) => {
    setInvalid(field);
    setError(message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    fail(null, '');

    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      fail('username', 'Usernames are 3–32 characters: letters, numbers, dots, dashes and underscores.');
      return;
    }

    if (password.length < 8 || password.length > 72) {
      fail('password', 'Passwords are 8–72 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      fail('confirmPassword', 'The two passwords don’t match. Type the same password in both boxes.');
      return;
    }

    setBusy(true);
    const result = await signup(username, password);
    setBusy(false);

    if (result.success) {
      // keep ?next= (e.g. an invite link) so login can return there
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(`/login?registered=true${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    } else {
      fail(null, result.error || 'Couldn’t create the account. Try a different username.');
    }
  };

  return (
    <AuthShell title="Create account">
      <p className="mt-2 text-asphalt-soft">You’ll pick your character after logging in.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {error && <FormError>{error}</FormError>}
        <Field
          id="username"
          label="Username"
          hint="3–32 characters: letters, numbers, dots, dashes and underscores."
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={invalid === 'username'}
          required
        />
        <Field
          id="password"
          label="Password"
          hint="At least 8 characters."
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={invalid === 'password'}
          required
        />
        <Field
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={invalid === 'confirmPassword'}
          required
        />
        <SubmitButton busy={busy} busyLabel="Creating account…">Create account</SubmitButton>
      </form>

      <p className="mt-8 text-asphalt-soft">
        Already have an account?{' '}
        <Link href={`/login${search}`} className="font-bold text-sign underline decoration-2 underline-offset-4 hover:text-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sign">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
};

export default Signup;
