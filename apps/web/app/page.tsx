/* eslint-disable @next/next/no-img-element */
"use client"
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/authContext';
import CampusMap from '@/components/campus/CampusMap';

const FEATURES = [
  {
    title: 'Walk up to someone to talk',
    body: "Voice and video switch on when you're a few tiles apart, and off again when you walk away. No calls to start or links to send.",
    art: 'pair',
  },
  {
    title: 'Take a seat',
    body: 'Sit on any bench, by the sports ground, the library pond or outside the canteen, and stay put while you talk.',
    art: '/campus/bench.png',
  },
  {
    title: 'Pin a note',
    body: 'Notice boards stand around campus. Leave a note and everyone who walks past can read it.',
    art: '/campus/notice-board.png',
  },
  {
    title: 'Make your own space',
    body: 'Keep a space private and share an invite link with your batch, or browse public spaces in Explore.',
    art: '/campus/sign-welcome.png',
  },
] as const;

function FeatureArt({ art }: { art: (typeof FEATURES)[number]['art'] }) {
  if (art === 'pair') {
    // two students facing each other, frames from the right- and left-walk cycles
    return (
      <div className="flex items-end gap-1">
        <div className="size-12 bg-no-repeat [image-rendering:pixelated]" style={{ backgroundImage: 'url(/avatars/cse-blue.png)', backgroundSize: '500% 500%', backgroundPosition: '25% 25%' }} />
        <div className="size-12 bg-no-repeat [image-rendering:pixelated]" style={{ backgroundImage: 'url(/avatars/rose.png)', backgroundSize: '500% 500%', backgroundPosition: '50% 50%' }} />
      </div>
    );
  }
  return <img src={art} alt="" className="max-h-14 max-w-[88px] [image-rendering:pixelated]" />;
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div className="font-body bg-plate text-asphalt">
      <section className="relative h-svh min-h-[560px] overflow-hidden">
        <CampusMap mode="drift" />

        <header className="relative z-10 flex items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
          <Link href="/" className="sign-plate px-6 py-2 font-pixel text-xl leading-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-plate">
            GEC Bilaspur campus
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-plate/95 px-4 py-2 font-bold text-asphalt shadow-[0_3px_0_#2e323833] hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sign"
          >
            Log in
          </Link>
        </header>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6 sm:px-8 sm:pb-10">
          <div className="max-w-xl">
            <h1 className="sign-plate px-6 pb-5 pt-6 font-pixel text-[2.5rem] leading-[1.05] sm:px-8 sm:text-[3.5rem]">
              GEC Bilaspur, open after hours
            </h1>
            <div className="mx-3 rounded-b-md bg-plate px-5 pb-5 pt-4 shadow-[0_4px_0_#2e323826] sm:mx-5 sm:px-6">
              <p className="max-w-[46ch] text-lg leading-relaxed">
                Walk the campus as a pixel character. Get close to a friend and your voice and video switch on; walk away and they switch off.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-md bg-sign px-5 py-2.5 font-bold text-plate shadow-[0_3px_0_#0f3226] hover:bg-sign-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sign active:translate-y-px active:shadow-[0_2px_0_#0f3226]"
                >
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="rounded-md border-2 border-asphalt/20 px-5 py-2 font-bold hover:border-asphalt/40 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sign"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-8 sm:py-24">
        <h2 className="font-pixel text-4xl text-sign sm:text-5xl">What you can do on campus</h2>
        <ul className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-5 border-t-2 border-sandstone pt-6">
              <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-md bg-sandstone-soft">
                <FeatureArt art={f.art} />
              </div>
              <div>
                <h3 className="text-xl font-bold">{f.title}</h3>
                <p className="mt-1.5 max-w-[42ch] leading-relaxed text-asphalt-soft">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="bg-sign text-plate">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-pixel text-3xl leading-tight sm:text-4xl">Pick a character and walk in.</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-plate px-5 py-2.5 font-bold text-sign shadow-[0_3px_0_#0f3226] hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plate"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-md border-2 border-plate/40 px-5 py-2 font-bold hover:border-plate focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plate"
            >
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
