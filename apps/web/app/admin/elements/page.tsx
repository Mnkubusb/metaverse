"use client"
import { useState, useEffect } from 'react';
import MainLayout from '../../../components/layout/MainLayout';
import ProtectedRoute from '../../../components/auth/protectedRoute';
import { adminAPI, spaceAPI } from '../../../lib/api';
import { useRouter } from 'next/navigation';

interface Space {
    elements?: Element[];
  }

  interface Element {
    elementId: string;
    imageUrl: string;
    width: number;
    height: number;
    isStatic?: boolean;
    layer: string;
  }

  interface ElementMapValue {
    id: string;
    imageUrl: string;
    width: number;
    height: number;
    isStatic: boolean;
    usageCount: number;
    layer: string;
  }

export default function ElementManager() {
  const [elements, setElements] = useState<ElementMapValue[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    imageUrl: '',
    width: 50,
    height: 50,
    isStatic: true,
    layer: "floor"
  });
  const [isEditing, setIsEditing] = useState(false);
  const [currentElementId, setCurrentElementId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchElements();
  }, []);

  // In a real app, we would have a dedicated endpoint for this
  // Here we're extracting elements from spaces as a simulation
  const fetchElements = async () => {
    try {
      setLoading(true);
      // This is a simulated approach - in a real app there would be a dedicated endpoint
      const spacesResponse = await spaceAPI.getAllSpaces();
      const spaces = spacesResponse.data.spaces || [];
      
      // Extract unique elements
    const elementMap = new Map();

   

    spaces.forEach((space: Space) => {
      if (space.elements) {
        space.elements.forEach((element: Element) => {
        if (!elementMap.has(element.elementId)) {
          elementMap.set(element.elementId, {
            id: element.elementId,
            imageUrl: element.imageUrl,
            width: element.width,
            height: element.height,
            isStatic: element.isStatic || false,
            layer: element.layer,
            usageCount: 1
          } as ElementMapValue);
        } else {
          const existingElement = elementMap.get(element.elementId) as ElementMapValue;
          existingElement.usageCount += 1;
        }
        });
      }
    });
      setElements(Array.from(elementMap.values()));
    } catch (error) {
      console.error('Error fetching elements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e : React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e : React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    try {
      if (isEditing && currentElementId) {
        await adminAPI.updateElement(currentElementId , formData.imageUrl);
      } else {
        formData.width = Number(formData.width);
        formData.height = Number(formData.height);
        await adminAPI.createElement(
          formData.imageUrl,
          formData.width,
          formData.height,
          formData.isStatic,
          formData.layer
        );
      }
      setFormSuccess("Element saved successfully!");
      resetForm();
      fetchElements();
    } catch (error) {
      console.error('Error saving element:', error);
      setFormError('Failed to save element. Please try again.');
    }
  };

  const handleEdit = (element : Element) => {
    setFormData({
      imageUrl: element.imageUrl,
      width: element.width,
      height: element.height,
      isStatic: element.isStatic as boolean,
      layer: element.layer
    });
    setCurrentElementId(element.elementId);
    setIsEditing(true);
  };

  const resetForm = () => {
    setFormData({
      imageUrl: '',
      width: 50,
      height: 50,
      isStatic: true,
      layer: 'floor'
    });
    setIsEditing(false);
    setCurrentElementId(null);
  };

  return (
    <ProtectedRoute adminOnly={true}>
      <MainLayout>
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Element Manager</h1>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">
                  {isEditing ? 'Edit Element' : 'Add New Element'}
                </h2>
                
                {formError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="bg-green-500 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {formSuccess}
                  </div>
                )}
                
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Image URL
                    </label>
                    <input
                      type="text"
                      name="imageUrl"
                      value={formData.imageUrl}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        name="width"
                        value={formData.width}
                        onChange={handleInputChange}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        name="height"
                        value={formData.height}
                        onChange={handleInputChange}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                        min="1"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="layer">
                      Layer
                    </label>
                    <input type="text"
                      value={formData.layer}
                      name='layer'
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      required
                      min="1"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isStatic"
                        checked={formData.isStatic}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-gray-700">Static Element (Collidable)</span>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <button
                      type="submit"
                      className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    >
                      {isEditing ? 'Update Element' : 'Create Element'}
                    </button>
                    
                    {isEditing && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Elements Library</h2>
                
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : elements.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No elements found. Create your first element!</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {elements.map((element) => (
                      <div 
                        key={element.id}
                        className="border rounded-lg p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="w-full h-32 bg-gray-200 rounded mb-3 flex items-center justify-center overflow-hidden">
                            {element.imageUrl ? (
                              <img 
                                src={element.imageUrl} 
                                alt="Element" 
                                className="object-contain w-full h-full" 
                              />
                            ) : (
                              <span className="text-gray-400">No image</span>
                            )}
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-sm">
                              <span className="font-medium">Size:</span> {element.width}×{element.height}px
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Type:</span> {element.isStatic ? 'Static' : 'Dynamic'}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Usage:</span> {element.usageCount} space(s)
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleEdit(element as any)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium py-1 px-2 rounded text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}