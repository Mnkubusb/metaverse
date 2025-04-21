import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/authContext';
import { spaceAPI , adminAPI , elementAPI} from '../../lib/api';

export type Element = {
    id: string;
    imageUrl: string;
    width: number;
    height: number;
    static: boolean;
}

const ElementManager = () => {
  const { token } = useAuth();
  const [elements, setElements] = useState<Element[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newElement, setNewElement] = useState({
    imageUrl: '',
    width: 1,
    height: 1,
    static: true
  });
  const [editingElement, setEditingElement] = useState< Element | null >(null);

  // Fetch all elements on component mount
  useEffect(() => {
    fetchElements();
  }, []);

  const fetchElements = async () => {
    try {
      setLoading(true);
      const response = await elementAPI.getElements();
      setElements(response.data.elements);
      setError("");
    } catch (err) {
      setError('Failed to fetch elements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e : React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    // Handle checkboxes (boolean values)
    const inputValue = type === 'checkbox' ? checked : 
                      (name === 'width' || name === 'height') ? Number(value) : value;
    
    if (editingElement) {
      setEditingElement({
        ...editingElement,
        [name]: inputValue
      });
    } else {
      setNewElement({
        ...newElement,
        [name]: inputValue
      });
    }
  };

  const handleCreateElement = async (e : React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await adminAPI.createElement(newElement.imageUrl, newElement.width, newElement.height ,newElement.static);
      
      setElements([...elements, response.data]);
      setNewElement({
        imageUrl: '',
        width: 1,
        height: 1,
        static: true
      });
      setError("");
    } catch (err) {
      setError('Failed to create element');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateElement = async (e : React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await adminAPI.updateElement( editingElement?.id as string, editingElement?.imageUrl as string);
      
      // Update the element in the local state
      const updatedElements = elements.map(element => 
        element.id === editingElement?.id ? editingElement : element
      );
      
      setElements(updatedElements);
      setEditingElement(null);
      setError("");
    } catch (err) {
      setError('Failed to update element');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteElement = async (elementId : string) => {
    try {
      setLoading(true);
      await spaceAPI.deleteElement(elementId);
      
      // Remove the element from the local state
      const updatedElements = elements.filter(element => element.id !== elementId);
      setElements(updatedElements);
      setError("");
    } catch (err) {
      setError('Failed to delete element');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (element : Element) => {
    setEditingElement({ ...element });
  };

  const cancelEditing = () => {
    setEditingElement(null);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Element Manager</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Create Element Form */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingElement ? 'Edit Element' : 'Create New Element'}
        </h2>
        
        <form onSubmit={editingElement ? handleUpdateElement : handleCreateElement}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="imageUrl">
              Image URL
            </label>
            <input
              type="text"
              id="imageUrl"
              name="imageUrl"
              value={editingElement ? editingElement.imageUrl : newElement.imageUrl}
              onChange={handleInputChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          
          <div className="flex mb-4">
            <div className="w-1/2 mr-2">
              <label className="block text-gray-700 mb-2" htmlFor="width">
                Width
              </label>
              <input
                type="number"
                id="width"
                name="width"
                min="1"
                value={editingElement ? editingElement.width : newElement.width}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            
            <div className="w-1/2 ml-2">
              <label className="block text-gray-700 mb-2" htmlFor="height">
                Height
              </label>
              <input
                type="number"
                id="height"
                name="height"
                min="1"
                value={editingElement ? editingElement.height : newElement.height}
                onChange={handleInputChange}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="static"
                checked={editingElement ? editingElement.static : newElement.static}
                onChange={handleInputChange}
                className="mr-2"
              />
              <span className="text-gray-700">Static Element (can&pos;t be moved)</span>
            </label>
          </div>
          
          <div className="flex justify-end">
            {editingElement && (
              <button
                type="button"
                onClick={cancelEditing}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded mr-2"
              >
                Cancel
              </button>
            )}
            
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? 'Processing...' : editingElement ? 'Update Element' : 'Create Element'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Elements List */}
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Elements</h2>
        
        {loading && !elements.length ? (
          <p className="text-center py-4">Loading elements...</p>
        ) : elements.length === 0 ? (
          <p className="text-center py-4">No elements found. Create one above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {elements.map(element => (
              <div key={element.id} className="border rounded p-4">
                <div className="flex justify-center mb-4">
                  <img 
                    src={element.imageUrl} 
                    alt={`Element ${element.id}`} 
                    className="max-h-40 object-contain"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/placeholder-image.png';
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">ID:</span> {element.id}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Size:</span> {element.width}x{element.height}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Type:</span> {element.static ? 'Static' : 'Movable'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col">
                    <button
                      onClick={() => startEditing(element)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded mb-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteElement(element.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded"
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
    </div>
  );
};

export default ElementManager;