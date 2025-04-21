"use client"
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { spaceAPI } from '../../lib/api';

export interface Space{
    id: string;
    name: string;
    dimensions: string;
    thumbnail: string;
}

export default function SpacesList() {
  const [spaces, setSpaces] = useState<Space[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteInProgress, setDeleteInProgress] = useState("");

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    try {
      const response = await spaceAPI.getAllSpaces();
      setSpaces(response.data.spaces || []);
    } catch (err) {
      setError('Failed to load spaces');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (spaceId : string) => {
    if (!confirm('Are you sure you want to delete this space?')) return;
    
    setDeleteInProgress(spaceId);
    
    try {
      await spaceAPI.deleteSpace(spaceId);
      setSpaces(spaces.filter(space => space.id !== spaceId));
    } catch (err) {
      setError('Failed to delete space');
      console.error(err);
    } finally {
      setDeleteInProgress("");
    }
  };

  if (loading) {
    return <div className="text-center p-4">Loading spaces...</div>;
  }
  return (
    <div className="container mx-auto p-4">
      {spaces.length === 0 ? (
        <div className="text-center p-8 bg-gray-100 rounded">
          <p>You haven&apos;t created any spaces yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map(space => (
            <div key={space.id} className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="p-4">
                <h3 className="font-bold text-xl mb-2">{space.name}</h3>
                <p className="text-gray-600">Dimensions: {space.dimensions}</p>
                <div className="flex justify-between mt-4">
                  <Link href={`/space/${space.id}`} className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
                    Enter
                  </Link>
                  <button 
                    onClick={() => handleDelete(space.id)} 
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
