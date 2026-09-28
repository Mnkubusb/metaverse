"use client";
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import SpacesList from '../../components/space/spaceLists';
import CreateSpaceDialog from '../../components/space/spaceCreator';

export default function Spaces() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="mx-auto grid w-full max-w-6xl gap-6 p-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My spaces</h1>
              <p className="text-sm text-gray-500">Rooms you&apos;ve created. Enter one to meet people there.</p>
            </div>
            <CreateSpaceDialog />
          </header>
          <SpacesList />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
