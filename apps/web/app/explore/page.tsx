"use client";
import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import CreateSpaceDialog from '../../components/space/spaceCreator';
import { spaceAPI } from '../../lib/api';
import SpaceCard, { SpaceGridSkeleton } from '../../components/space/SpaceCard';

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
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-pixel text-4xl leading-none text-sign sm:text-5xl">Explore</h1>
              <p className="mt-2 max-w-[56ch] text-muted-foreground">Public spaces anyone at GEC can walk into. Make yours public from its settings.</p>
            </div>
            <CreateSpaceDialog />
          </header>

          {state === 'error' && spaces.length === 0 && (
            <p role="alert" className="rounded-lg border border-brick/25 bg-brick/8 px-3 py-2 text-sm text-brick">
              Couldn&apos;t load public spaces. Check your connection and reload.
            </p>
          )}

          {state === 'ready' && spaces.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-10 text-center">
              <p className="font-semibold text-foreground">No public spaces yet</p>
              <p className="text-sm text-muted-foreground">Create one and choose &quot;Public&quot; so others can find it here.</p>
            </div>
          )}

          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <li key={s.id}>
                <SpaceCard href={`/space/${s.id}`} name={s.name} thumbnail={s.thumbnail}
                  detail={<span className="flex items-center gap-3"><span className="truncate">by {s.owner}</span><span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums" title="Members"><Users className="size-3.5" /> {s.members}</span></span>} />
              </li>
            ))}
          </ul>

          {state === 'loading' && (spaces.length === 0
            ? <SpaceGridSkeleton />
            : <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-muted-foreground/75" /></div>)}
          {state === 'ready' && hasMore && (
            <button type="button" onClick={() => setPage((p) => p + 1)}
              className="mx-auto h-10 rounded-lg bg-card px-5 text-sm font-bold text-foreground ring-1 ring-border transition hover:ring-sign/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Load more
            </button>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
