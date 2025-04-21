import React, { useEffect, useState } from 'react';
import { adminAPI, defaultElement, elementAPI } from '../../lib/api';
import { Element } from '../admin/ElementsManager';

interface Map {
  id: string;
  name: string;
  thumbnail: string;
  dimensions: string;
  defaultElement: defaultElement[];
}

const MapManager = () => {
  const [maps, setMaps] = useState<Map[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const[elements , setElements] = useState<Element[] | []>([]);
  const [newMap, setNewMap] = useState({
    name: 'New Map',
    thumbnail: '',
    dimensions: '100x100',
    defaultElement: []
  });
  const [selectedElements, setSelectedElements] = useState<defaultElement[] | []>([]);


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
    const { name, value } = e.target;
    setNewMap({
      ...newMap,
      [name]: value
    });
  };

  const handleAddDefaultElement = () => {
    const elementToAdd = {
      elementId: '',
      x: 0,
      y: 0
    };
    
    setSelectedElements([...selectedElements, elementToAdd]);
  };

  const handleElementChange = (index : number, field : string, value : string) => {
    const updatedElements = [...selectedElements];
    updatedElements[index] = {
      ...updatedElements[index],
      [field]: field === 'elementId' ? value : parseFloat(value)
    } as defaultElement;
    
    setSelectedElements(updatedElements);
  };

  const handleRemoveElement = (index : number) => {
    const updatedElements = selectedElements.filter((_, i) => i !== index);
    setSelectedElements(updatedElements);
  };

  const handleCreateMap = async (e : React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate that selected elements have valid elementIds
      const validElements = selectedElements.filter(el => el.elementId);
      
      const mapData = {
        ...newMap,
        defaultElement: validElements
      };
      console.log(mapData)
      const response = await adminAPI.createMap(mapData.thumbnail , mapData.dimensions, mapData.name, mapData.defaultElement);
      console.log(response)
      setMaps([...maps, response.data]);
      setNewMap({
        name: '',
        thumbnail: '',
        dimensions: '100x100',
        defaultElement: []
      });
      setSelectedElements([]);
      setError("");
      
    } catch (err) {
      setError('Failed to create map');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Map Manager</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Create Map Form */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Map</h2>
        
        <form onSubmit={handleCreateMap}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="name">
              Map Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={newMap.name}
              onChange={handleInputChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="thumbnail">
              Thumbnail URL
            </label>
            <input
              type="text"
              id="thumbnail"
              name="thumbnail"
              value={newMap.thumbnail}
              onChange={handleInputChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="dimensions">
              Dimensions (width x height)
            </label>
            <input
              type="text"
              id="dimensions"
              name="dimensions"
              value={newMap.dimensions}
              onChange={handleInputChange}
              className="w-full border rounded px-3 py-2"
              placeholder="100x100"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">
              Default Elements
            </label>
            
            <button
              type="button"
              onClick={handleAddDefaultElement}
              className="bg-green-500 text-white px-4 py-2 rounded mb-4"
            >
              Add Default Element
            </button>
            
            {selectedElements.length > 0 && (
              <div className="space-y-4">
                {selectedElements.map((element, index) => (
                  <div key={index} className="flex flex-wrap items-center border p-3 rounded">
                    <div className="w-full md:w-1/3 md:pr-2 mb-2 md:mb-0">
                      <label className="block text-sm text-gray-700 mb-1">Element</label>
                      <select
                        value={element.elementId}
                        onChange={(e) => handleElementChange(index, 'elementId', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        required
                      >
                        <option value="">Select an element</option>
                        {elements.map(el => (
                          <option key={el.id} value={el.id}>
                            {el.id} ({el?.width}x{el.height})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-1/2 md:w-1/4 pr-1 md:px-2">
                      <label className="block text-sm text-gray-700 mb-1">X Position</label>
                      <input
                        type="number"
                        value={element.x}
                        onChange={(e) => handleElementChange(index, 'x', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div className="w-1/2 md:w-1/4 pl-1 md:px-2">
                      <label className="block text-sm text-gray-700 mb-1">Y Position</label>
                      <input
                        type="number"
                        value={element.y}
                        onChange={(e) => handleElementChange(index, 'y', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div className="w-full md:w-auto mt-2 md:mt-6 md:ml-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveElement(index)}
                        className="bg-red-500 text-white px-3 py-1 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Map'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Maps List */}
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Maps</h2>
        
        {loading && !maps.length ? (
          <p className="text-center py-4">Loading maps...</p>
        ) : maps.length === 0 ? (
          <p className="text-center py-4">No maps found. Create one above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {maps.map(map => (
              <div key={map.id} className="border rounded p-4">
                <div className="flex justify-center mb-4">
                  <img 
                    src={map.thumbnail} 
                    alt={map.name} 
                    className="max-h-40 object-contain"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/placeholder-image.png';
                    }}
                  />
                </div>
                
                <div>
                  <h3 className="text-lg font-medium">{map.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">ID: {map.id}</p>
                  <p className="text-sm">Dimensions: {map.dimensions}</p>
                  <p className="text-sm">
                    Default Elements: {map.defaultElement?.length || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapManager;