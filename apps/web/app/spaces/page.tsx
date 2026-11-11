"use client";
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import SpacesList from '../../components/space/spaceLists';
import CreateSpaceDialog from '../../components/space/spaceCreator';

export default function Spaces() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-pixel text-4xl leading-none text-sign sm:text-5xl">My spaces</h1>
              <p className="mt-2 max-w-[56ch] text-muted-foreground">Rooms you&apos;ve created. Enter one to meet people there.</p>
            </div>
            <CreateSpaceDialog />
          </header>
          <SpacesList />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
