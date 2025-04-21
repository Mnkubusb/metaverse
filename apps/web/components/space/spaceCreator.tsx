"use client"
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { spaceAPI , mapAPI, defaultElement } from '../../lib/api';

interface Map {
    id: string;
    name: string;
    width: number;
    height: number;
    thumbnail: string;
    defaultElement: defaultElement[];
}

export default function SpaceCreator() {
  const [name, setName] = useState('');
  const [dimensions, setDimensions] = useState("");
  const [mapId, setMapId] = useState('');
  const [maps, setMaps] = useState<Map[] | []>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMap , setSelectedMap] = useState<Map | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const response = await mapAPI.getMaps();
        const maps = response.data.maps || [];
        setMaps(maps);
      } catch (err) {
        console.error('Error fetching maps:', err);
      }
    };

    fetchMaps();
  }, []);

  const handleSubmit = async (e : React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {

      const response = await spaceAPI.createSpace(name, dimensions, mapId);

      if (response.data && response.data.spaceId) {
        router.push(`/space/${response.data.spaceId}`);
      } else {
        setError('Failed to create space');
      }
    } catch (err) {
      setError('Error creating space');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Create New Space</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            Space Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="dimensions">
            Dimensions (width x height)
          </label>
          <input
            ref={inputRef}
            id="dimensions"
            type="text"
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value) }
            placeholder="e.g. 100x200"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mapId">
            Select Map Template
          </label>
          <select
            id="mapId"
            value={mapId}
            onChange={(e) => {
              setSelectedMap(maps.find((map) => map.id === e.target.value) || null);
              setDimensions(selectedMap?.width + 'x' + selectedMap?.height || '')
              console.log(inputRef.current?.value);
              setMapId(e.target.value);
            }}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">-- Select a Map --</option>
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name} ({map.width}x{map.height})
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 rounded-md ${
              loading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loading ? 'Creating...' : 'Create Space'}
          </button>
        </div>
      </form>
    </div>
  );
}
