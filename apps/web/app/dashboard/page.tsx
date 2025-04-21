"use client";
import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import { useAuth } from '../../contexts/authContext';
import { spaceAPI, avatarAPI, userAPI } from '../../lib/api';
import Link from 'next/link';
import { Avatar } from '../../components/admin/avatarManager';
import { Space } from '../../components/space/spaceLists';

export default function Dashboard() {
  const [spaces, setSpaces] = useState<Space[] | []>([]);
  const [avatars, setAvatars] = useState<Avatar[] | []>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch spaces
        const spacesResponse = await spaceAPI.getAllSpaces();
        setSpaces(spacesResponse.data.spaces || []);
        
        // Fetch avatars
        const avatarsResponse = await avatarAPI.getAvatars();
        setAvatars(avatarsResponse.data.avatars || []);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAvatarSelect = async (avatarId : string) => {
    try {
      setSelectedAvatar(avatarId );
      await userAPI.updateMetadata(avatarId);
    } catch (error) {
      console.error('Error updating avatar:', error);
    }
  };

  const recentSpaces = spaces.slice(0, 5);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Welcome, {user?.username}</h1>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Your Avatar</h2>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                {avatars.map((avatar , index) => (
                  <div 
                    key={avatar._id || index}
                    className={`cursor-pointer border-2 rounded p-2 hover:bg-blue-50 ${
                      selectedAvatar === avatar._id ? 'border-blue-500 bg-blue-100' : 'border-gray-200'
                    }`}
                    onClick={() => handleAvatarSelect(avatar._id)}
                  >
                    <img 
                      src={avatar.imageUrl} 
                      alt={avatar.name} 
                      className="w-full h-auto"
                    />
                    <p className="text-center mt-2 text-sm">{avatar.name}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Spaces</h2>
                <Link href="/spaces" className="text-blue-500 hover:text-blue-700">
                  View All
                </Link>
              </div>
              
              {recentSpaces.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {recentSpaces.map((space) => (
                    <li key={space.id} className="py-3">
                      <Link href={`/space/${space.id}`} className="flex items-center">
                        <div className="w-12 h-12 bg-gray-200 rounded mr-4">
                          {space.thumbnail && (
                            <img 
                              src={space.thumbnail} 
                              alt={space.name} 
                              className="w-full h-full object-cover rounded"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{space.name}</p>
                          {/* <p className="text-sm text-gray-500">
                            {space.usersCount || 0} users active
                          </p> */}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No spaces available.</p>
              )}
              
              <div className="mt-6">
                <Link href="/spaces" className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded text-center">
                  Explore Spaces
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}