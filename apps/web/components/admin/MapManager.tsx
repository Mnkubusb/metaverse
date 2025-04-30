/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import { useAuth } from '../../contexts/authContext';

interface Map {
  id: string;
  name: string;
  thumbnail: string;
  dimensions: string;
  defaultElement: Array<{
    elementId: string;
    x: number;
    y: number;
  }>;
}

const  MapManager: React.FC = () => {
  const { token } = useAuth();
  const router = useRouter();
  const [maps, setMaps] = useState<Map[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch all maps
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/admin/maps', {
          headers: {
            authorization: `Bearer ${token}`
          }
        });

        if (response.data && response.data.maps) {
          setMaps(response.data.maps);
        }
        setIsLoading(false);
      } catch (e) {
        console.log(e)
        setError('Failed to load maps');
        setIsLoading(false);
      }
    };

    fetchMaps();
  }, [token]);

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      setIsLoading(true);
      await api.delete(`/admin/map/${deleteId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      // Remove the deleted map from state
      setMaps(maps.filter(map => map.id !== deleteId));
      setShowDeleteModal(false);
      setDeleteId(null);
      setIsLoading(false);
    } catch (e) {
      console.log(e)
      setError('Failed to delete map');
      setIsLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Maps Manager</h1>
        <Link href="/admin/maps/create" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Create New Map
        </Link>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {isLoading && <p className="text-center py-4">Loading maps...</p>}

      {!isLoading && maps.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No maps found</p>
          <Link href="/admin/maps/create" className="text-blue-500 hover:underline">
            Create your first map
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {maps.map(map => (
          <div key={map.id} className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="h-40 bg-gray-200 relative">
              {map.thumbnail ? (
                <img
                  src={map.thumbnail}
                  alt={map.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No thumbnail
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2">
                <h3 className="font-medium truncate">{map.name}</h3>
                <p className="text-sm">Dimensions: {map.dimensions}</p>
              </div>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-2">
                Elements: {map.defaultElement ? map.defaultElement.length : 0}
              </p>

              <div className="flex justify-between">
                <button
                  onClick={() => router.push(`/admin/maps/edit/${map.id}`)}
                  className="text-blue-500 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(map.id)}
                  className="text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Confirm Deletion</h3>
            <p className="mb-6">Are you sure you want to delete this map? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                disabled={isLoading}
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapManager;