"use client"
import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import CampusMap from '@/components/campus/CampusMap';

// The main gate, where every visitor arrives: the view is centred on its column.
const GATE: [number, number] = [37.6, 50];

export default function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="font-body grid min-h-svh bg-plate text-asphalt md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="relative h-44 overflow-hidden md:h-auto">
        <CampusMap mode="gate" focus={GATE} />
        <Link
          href="/"
          className="sign-plate absolute left-4 top-4 px-6 py-2 font-pixel text-xl leading-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-plate sm:left-8 sm:top-6"
        >
          GEC Bilaspur campus
        </Link>
      </div>

      <main className="flex items-start justify-center px-4 py-10 sm:px-8 md:items-center md:py-16">
        <div className="w-full max-w-sm">
          <h1 className="font-pixel text-5xl leading-none text-sign">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  const isPassword = input.type === 'password';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          {...input}
          type={isPassword && shown ? 'text' : input.type}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="h-12 w-full rounded-md border-2 border-asphalt/20 bg-white px-3.5 text-base text-asphalt outline-none transition-colors placeholder:text-asphalt-soft/70 hover:border-asphalt/35 focus:border-sign focus:ring-4 focus:ring-sign/15 aria-[invalid=true]:border-brick"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            className="absolute inset-y-0 right-1 my-1 flex w-10 items-center justify-center rounded text-asphalt-soft hover:text-asphalt focus-visible:outline-2 focus-visible:outline-sign"
          >
            {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {hint && <p id={`${id}-hint`} className="text-sm text-asphalt-soft">{hint}</p>}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border-l-4 border-brick bg-brick/8 px-3.5 py-2.5 text-[0.95rem] text-brick">
      {children}
    </p>
  );
}

export function SubmitButton({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-2 h-12 w-full rounded-md bg-sign font-bold text-plate shadow-[0_3px_0_#0f3226] transition-colors hover:bg-sign-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sign active:translate-y-px active:shadow-[0_2px_0_#0f3226] disabled:cursor-wait disabled:opacity-70"
    >
      {busy ? busyLabel : children}
    </button>
  );
}
