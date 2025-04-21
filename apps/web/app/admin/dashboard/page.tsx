"use client"
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '../../../components/layout/MainLayout';
import ProtectedRoute from '../../../components/auth/protectedRoute';
import Link from 'next/link';
import { spaceAPI } from '../../../lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    spaces: 0,
    elements: 0,
    maps: 0,
    avatars: 0,
    users: 0
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // In a real application, we would have a dedicated API endpoint to fetch admin stats
    // For this example, we'll use the spaces endpoint and simulate the other stats
    const fetchStats = async () => {
      try {
        const spacesResponse = await spaceAPI.getAllSpaces();
        const spaces = spacesResponse.data.spaces || [];
        // Count unique elements across all spaces
        interface Space {
          elements?: Element[];
        }

        interface Element {
          elementId: string;
        }

        const uniqueElements = new Set<string>();
        spaces.forEach((space: Space) => {
          if (space.elements) {
            space.elements.forEach((element: Element) => {
              uniqueElements.add(element.elementId);
            });
          }
        });

        setStats({
          spaces: spaces.length,
          elements: uniqueElements.size,
          // These would come from actual API endpoints in a real app
          maps: 5,
          avatars: 8,
          users: 25
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const adminCards = [
    {
      title: 'Elements',
      count: stats.elements,
      icon: '🧩',
      link: '/admin/elements'
    },
    {
      title: 'Maps',
      count: stats.maps,
      icon: '🗺️',
      link: '/admin/maps'
    },
    {
      title: 'Avatars',
      count: stats.avatars,
      icon: '👤',
      link: '/admin/avatars'
    },
    {
      title: 'Spaces',
      count: stats.spaces,
      icon: '🏙️',
      link: '/spaces'
    },
    {
      title: 'Users',
      count: stats.users,
      icon: '👥',
      link: '#' // Would link to a user management page in a real app
    }
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <ProtectedRoute adminOnly={true}>
      <MainLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          
          <div className="grid md:grid-cols-3 gap-6">
            {adminCards.map((card) => (
              <Link 
                href={card.link} 
                key={card.title}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-gray-600">{card.title}</p>
                    <p className="text-3xl font-bold mt-2">{card.count}</p>
                  </div>
                  <div className="text-4xl">{card.icon}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button 
                  onClick={() => router.push('/admin/elements')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded"
                >
                  ➕ Add New Element
                </button>
                <button 
                  onClick={() => router.push('/admin/maps')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded"
                >
                  ➕ Create New Map
                </button>
                <button 
                  onClick={() => router.push('/admin/avatars')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded"
                >
                  ➕ Add New Avatar
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">System Status</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>API Server</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>WebSocket Server</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Database</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Healthy</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Storage</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">75% Used</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}