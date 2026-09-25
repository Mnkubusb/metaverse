"use client"
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { spaceAPI } from '../../lib/api';
import CreateSpaceDialog from './spaceCreator';

export interface Space{
    id: string;
    name: string;
    dimensions: string;
    thumbnail: string;
    visibility?: 'Private' | 'Unlisted' | 'Public';
}

const VISIBILITY_LABEL = { Private: 'Private', Unlisted: 'Link only', Public: 'Public' } as const;

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
    <div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {spaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-800">No spaces yet</p>
          <p className="text-sm text-gray-500">Create one from the GEC Bilaspur campus map and invite your friends.</p>
          <CreateSpaceDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map(space => (
            <div key={space.id} className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              {space.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={space.thumbnail} alt="" className="aspect-[76/54] w-full object-cover [image-rendering:pixelated]" />
              )}
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-bold text-xl">{space.name}</h3>
                  {space.visibility && (
                    <span className="mt-1 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {VISIBILITY_LABEL[space.visibility]}
                    </span>
                  )}
                </div>
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
