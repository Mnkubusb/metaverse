"use client";
import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import { avatarAPI, spaceAPI } from '../../lib/api';
import { useAuth } from '../../contexts/authContext';
import AvatarPicker, { AvatarSprite } from '../../components/avatar/AvatarPicker';
import Link from 'next/link';
import { Space, VISIBILITY_LABEL } from '../../components/space/spaceLists';
import SpaceCard, { SpaceGridSkeleton, VisibilityBadge } from '../../components/space/SpaceCard';
import { ArrowRight, Plus } from 'lucide-react';
import CreateSpaceDialog from '../../components/space/spaceCreator';

export default function Dashboard() {
  const [spaces, setSpaces] = useState<Space[] | []>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [joined, setJoined] = useState<(Space & { owner: string })[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    avatarAPI.getUserAvatar(user.id)
      .then((res) => setAvatarUrl(res.data.avatar?.imageUrl ?? null))
      .catch(() => { /* keep the default character */ });
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [spacesResponse, joinedResponse] = await Promise.all([
          spaceAPI.getAllSpaces(),
          spaceAPI.getJoinedSpaces().catch(() => ({ data: { spaces: [] } })),
        ]);
        setSpaces(spacesResponse.data.spaces || []);
        setJoined(joinedResponse.data.spaces || []);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const recentSpaces = spaces.slice(0, 6);
  const avatarButton = (
    <AvatarPicker
      currentUrl={avatarUrl}
      onSaved={(a) => setAvatarUrl(a.imageUrl)}
      trigger={
        <button type="button" className="flex h-11 items-center gap-2.5 overflow-hidden rounded-lg bg-card pl-1 pr-4 font-bold text-foreground ring-1 ring-border transition hover:ring-sign/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="relative size-9 overflow-hidden rounded-md bg-[#84c669]">
            <AvatarSprite url={avatarUrl ?? '/Characters/WalkAnimations.png'} className="absolute -left-[22px] -top-3" />
          </span>
          Change avatar
        </button>
      }
    />
  );

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <h1 className="font-pixel text-4xl leading-none text-sign sm:text-5xl">
                {user?.username ? `Welcome back, ${user.username}` : 'Welcome back'}
              </h1>
              <p className="mt-2 max-w-[52ch] text-muted-foreground">
                Pick up where you left off, or start a new space from the campus map.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {avatarButton}
              <CreateSpaceDialog trigger={
                <button type="button" className="flex h-11 items-center gap-2 rounded-lg bg-sign px-4 font-bold text-plate shadow-[0_3px_0_#0f3226] transition-colors hover:bg-sign-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px active:shadow-[0_2px_0_#0f3226]">
                  <Plus className="size-4" strokeWidth={2.5} /> New space
                </button>
              } />
            </div>
          </header>

          <section aria-labelledby="yours" className="mt-12">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="yours" className="text-lg font-bold">Your spaces</h2>
              {spaces.length > recentSpaces.length && (
                <Link href="/spaces" className="text-sm font-bold text-sign underline-offset-4 hover:underline">All {spaces.length} spaces</Link>
              )}
            </div>
            {isLoading ? <SpaceGridSkeleton count={3} /> : recentSpaces.length > 0 ? (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {recentSpaces.map((space) => (
                  <li key={space.id}>
                    <SpaceCard href={`/space/${space.id}`} name={space.name} thumbnail={space.thumbnail}
                      detail={`${space.dimensions.replace('x', ' × ')} tiles`}
                      badge={space.visibility && <VisibilityBadge label={VISIBILITY_LABEL[space.visibility]} />} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-border p-8">
                <p className="font-bold">You haven&apos;t made a space yet</p>
                <p className="max-w-[56ch] text-sm text-muted-foreground">A space is your own copy of the campus. Make one, share the invite link, and meet your friends there.</p>
                <CreateSpaceDialog />
              </div>
            )}
          </section>

          <section aria-labelledby="joined" className="mt-14">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="joined" className="text-lg font-bold">Joined</h2>
              <Link href="/explore" className="flex items-center gap-1 text-sm font-bold text-sign underline-offset-4 hover:underline">
                Explore public spaces <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {isLoading ? <SpaceGridSkeleton count={3} /> : joined.length > 0 ? (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {joined.map((space) => (
                  <li key={space.id}>
                    <SpaceCard href={`/space/${space.id}`} name={space.name} thumbnail={space.thumbnail} detail={`by ${space.owner}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Spaces you enter from invite links or Explore show up here.</p>
            )}
          </section>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
