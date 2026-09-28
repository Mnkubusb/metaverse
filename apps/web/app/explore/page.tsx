"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Loader2, Users } from 'lucide-react';
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import CreateSpaceDialog from '../../components/space/spaceCreator';
import { spaceAPI } from '../../lib/api';

interface PublicSpace {
  id: string;
  name: string;
  dimensions: string;
  thumbnail: string | null;
  owner: string;
  members: number;
}

export default function Explore() {
  const [spaces, setSpaces] = useState<PublicSpace[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setState('loading');
    spaceAPI.explore(page)
      .then((res) => {
        setSpaces((prev) => (page === 1 ? res.data.spaces : [...prev, ...res.data.spaces]));
        setHasMore(res.data.hasMore);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [page]);

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto grid w-full max-w-6xl gap-6 p-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Globe className="size-6 text-blue-600" /> Explore</h1>
              <p className="text-sm text-gray-500">Public spaces anyone at GEC can walk into. Make yours public from its settings.</p>
            </div>
            <CreateSpaceDialog />
          </header>

          {state === 'error' && spaces.length === 0 && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Couldn&apos;t load public spaces. Check your connection and reload.
            </p>
          )}

          {state === 'ready' && spaces.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
              <p className="font-semibold text-gray-800">No public spaces yet</p>
              <p className="text-sm text-gray-500">Create one and choose &quot;Public&quot; so others can find it here.</p>
            </div>
          )}

          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <li key={s.id}>
                <Link href={`/space/${s.id}`}
                  className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
                  <div className="aspect-[76/54] bg-gray-100">
                    {s.thumbnail
                      ? <img src={s.thumbnail} alt="" className="h-full w-full object-cover [image-rendering:pixelated]" />
                      : <div className="h-full w-full bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px]" />}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 group-hover:text-blue-700">{s.name}</p>
                      <p className="truncate text-xs text-gray-500">by {s.owner} · {s.dimensions.replace('x', ' × ')} tiles</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-gray-600" title="Members">
                      <Users className="size-3.5" /> {s.members}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {state === 'loading' && (
            <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-gray-400" /></div>
          )}
          {state === 'ready' && hasMore && (
            <button type="button" onClick={() => setPage((p) => p + 1)}
              className="mx-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              Load more
            </button>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
