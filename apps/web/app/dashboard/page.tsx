/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import { avatarAPI, spaceAPI } from '../../lib/api';
import { useAuth } from '../../contexts/authContext';
import AvatarPicker, { AvatarSprite } from '../../components/avatar/AvatarPicker';
import Link from 'next/link';
import { Space } from '../../components/space/spaceLists';
import CreateSpaceDialog from '../../components/space/spaceCreator';

export default function Dashboard() {
  const [spaces, setSpaces] = useState<Space[] | []>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
        const spacesResponse = await spaceAPI.getAllSpaces();
        setSpaces(spacesResponse.data.spaces || []);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const recentSpaces = spaces.slice(0, 5);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      </MainLayout>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="max-w-screen mx-auto w-full my-4">
          <div className="flex lg:w-6xl w-4xl gap-8 mx-auto">
            <div className="px-4 w-full">
              <div className="flex justify-between items-center mb-4">
                <div className='flex justify-between items-center gap-2'>
                  <h2 className="text-md font-semibold font-geist-sans">Recent</h2>
                  <div className='w-[0.5px] h-3 bg-gray-500 border'/>
                  <h2 className="text-md font-semibold text-gray-400 font-geist-sans">My Spaces</h2>
                </div>
                <div className="flex items-center gap-2">
                <AvatarPicker
                  currentUrl={avatarUrl}
                  onSaved={(a) => setAvatarUrl(a.imageUrl)}
                  trigger={
                    <button type="button" className="flex h-10 items-center gap-2 overflow-hidden rounded-md border border-gray-200 bg-white pl-1 pr-3 font-geist-sans font-medium text-gray-800 shadow-sm hover:bg-gray-50">
                      <span className="relative size-8 overflow-hidden rounded bg-emerald-50">
                        <AvatarSprite url={avatarUrl ?? '/Characters/WalkAnimations.png'} className="absolute -left-6 -top-3" />
                      </span>
                      My avatar
                    </button>
                  }
                />
                <CreateSpaceDialog trigger={
                  <button type="button" className="bg-blue-500 p-2 text-white font-geist-sans font-medium px-4 rounded-md hover:bg-blue-700 flex justify-center items-center shadow">
                    + Create Space
                  </button>
                } />
                </div>
              </div>

              {recentSpaces.length > 0 ? (
                <ul className="divide-x divide-gray-200 flex flex-wrap">
                  {recentSpaces.map((space) => (
                    <li key={space.id} className="py-3 px-2">
                      <Link href={`/space/${space.id}`} className="flex flex-col gap-2 " >
                        <div className="w-80 h-48 bg-gray-200 rounded-md">
                          {space.thumbnail && (
                            <img
                              src={space.thumbnail}
                              alt={space.name}
                              className="w-full h-full object-cover rounded"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium ml-1">{space.name}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No spaces available.</p>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}