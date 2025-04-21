"use client"
import React, { useState, useEffect } from 'react';
import { avatarAPI, adminAPI } from '../../lib/api';

export interface Avatar {
    id: string;
    name: string;
    imageUrl: string;
}

const AvatarManager = () => {
  const [avatars, setAvatars] = useState<Avatar[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAvatar, setNewAvatar] = useState({
    name: '',
    imageUrl: ''
  });

  // Fetch all avatars on component mount
  useEffect(() => {
    fetchAvatars();
  }, []);

  const fetchAvatars = async () => {
    try {
      setLoading(true);
      const response = await avatarAPI.getAvatars();
      setAvatars(response.data.avatars || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch avatars');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e : React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewAvatar({
      ...newAvatar,
      [name]: value
    });
  };

  const handleCreateAvatar = async (e : React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await adminAPI.createAvatar(newAvatar.imageUrl, newAvatar.name);
      
      setAvatars([...avatars, response.data]);
      setNewAvatar({
        name: '',
        imageUrl: ''
      });
      setError(null);
    } catch (err) {
      setError('Failed to create avatar');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Avatar Manager</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Create Avatar Form */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Avatar</h2>
        
        <form onSubmit={handleCreateAvatar}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="name">
              Avatar Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={newAvatar.name}
              onChange={handleInputChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="imageUrl">
              Image URL
            </label>
            <input
              type="text"
              id="imageUrl"
              name="imageUrl"
              value={newAvatar.imageUrl}
              onChange={handleInputChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          
          {newAvatar.imageUrl && (
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Preview</label>
              <div className="w-24 h-24 border rounded overflow-hidden">
                <img
                  src={newAvatar.imageUrl}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder-avatar.png';
                  }}
                />
              </div>
            </div>
          )}
          
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Avatar'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Avatars List */}
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Avatars</h2>
        
        {loading && !avatars.length ? (
          <p className="text-center py-4">Loading avatars...</p>
        ) : avatars.length === 0 ? (
          <p className="text-center py-4">No avatars found. Create one above.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {avatars.map(avatar => (
              <div key={avatar.id} className="border rounded p-3 text-center">
                <div className="w-20 h-20 mx-auto mb-2 overflow-hidden rounded-full bg-gray-100">
                  <img
                    src={avatar.imageUrl}
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/placeholder-avatar.png';
                    }}
                  />
                </div>
                <h3 className="font-medium text-sm truncate">{avatar.name}</h3>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarManager;