import { useState, useEffect } from 'react';
import { avatarAPI, userAPI } from '../../lib/api';
import { useAuth } from '../../contexts/authContext';

interface Avatar {
    id: string;
    imageUrl: string;
    name: string;
}

export default function AvatarSelection() {
  const [avatars, setAvatars] = useState<Avatar[] | [] >([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { token } = useAuth();

  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const response = await avatarAPI.getAvatars();
        setAvatars(response.data.avatars || []);
      } catch (err) {
        setError('Failed to load avatars');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAvatars();
    }
  }, [token]);

  const handleSelectAvatar = ( avatar: Avatar ) => {
    setSelectedAvatar(avatar);
    setError('');
    setSuccess('');
  };

  const handleUpdateAvatar = async () => {
    if (!selectedAvatar) {
      setError('Please select an avatar first');
      return;
    }

    setUpdating(true);
    setError('');
    
    try {
      await userAPI.updateMetadata(selectedAvatar?.id);
      setSuccess('Avatar updated successfully!');
    } catch (err) {
      setError('Failed to update avatar');
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="text-center p-4">Loading avatars...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Select Your Avatar</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
        {avatars.map((avatar) => (
          <div 
            key={avatar.id}
            className={`cursor-pointer border-2 p-2 rounded-lg ${
              selectedAvatar?.id === avatar.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
            onClick={() => handleSelectAvatar(avatar)}
          >
            <div className="aspect-square overflow-hidden relative">
              <img 
                src={avatar.imageUrl} 
                alt={avatar.name}
                className="object-cover w-full h-full"
              />
            </div>
            <p className="text-center mt-2">{avatar.name}</p>
          </div>
        ))}
      </div>
      
      {avatars.length === 0 && (
        <p className="text-center text-gray-500 my-4">No avatars available.</p>
      )}
      
      <div className="flex justify-center mt-4">
        <button
          onClick={handleUpdateAvatar}
          disabled={!selectedAvatar || updating}
          className={`px-4 py-2 rounded-md ${
            !selectedAvatar || updating
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {updating ? 'Updating...' : 'Select This Avatar'}
        </button>
      </div>
    </div>
  );
}