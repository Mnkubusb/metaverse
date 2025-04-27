/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
"use client"
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api, { adminAPI, elementAPI } from '../../lib/api';
import { useAuth } from '../../contexts/authContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Element {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  static: boolean;
}

interface DefaultElement {
  elementId: string;
  x: number;
  y: number;
}

interface MapEditorProps {
  mapId?: string;
}

const TILE_SIZE = 32;

const MapEditor: React.FC<MapEditorProps> = ({ mapId }) => {
  const { token } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  const [availableElements, setAvailableElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [defaultElements, setDefaultElements] = useState<DefaultElement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchElements = async () => {
      try {
        setIsLoading(true);
        const response = await elementAPI.getElements();
        if (response.data && response.data.elements) {
          setAvailableElements(response.data.elements);
        }
        setIsLoading(false);
      } catch {
        setError('Failed to load elements');
        setIsLoading(false);
      }
    };
    fetchElements();
  }, [token]);

  useEffect(() => {
    if (mapId) {
      const fetchMapData = async () => {
        try {
          setIsLoading(true);
          const response = await api.get(`/admin/map/${mapId}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          console.log(response.data)
          const { name, thumbnail, dimensions, elements } = response.data;
          setName(name);
          setThumbnail(thumbnail);
          const [w, h] = dimensions.split('x').map(Number);
          setWidth(w);
          setHeight(h);
          setDefaultElements(elements.map((element: any) => ({ ...element, elementId: element.element?.id })) || []);
          setIsLoading(false);
        } catch {
          setError('Failed to load map data');
          setIsLoading(false);
        }
      };
      fetchMapData();
    }
  }, [mapId, token]);

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedElement || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    setDefaultElements([...defaultElements, { elementId: selectedElement, x, y }]);
  };

  const removeDefaultElement = (index: number) => {
    setDefaultElements(defaultElements.filter((_, i) => i !== index));
  };

  const updateDefaultElement = (index: number, updated: DefaultElement) => {
    const updatedElements = [...defaultElements];
    updatedElements[index] = updated;
    setDefaultElements(updatedElements);
  };

  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const handleDropOnGrid = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggingIndex === null || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const updatedElements = [...defaultElements];
    updatedElements[draggingIndex] = {
      ...updatedElements[draggingIndex],
      x,
      y,
      elementId: updatedElements[draggingIndex]?.elementId || '',
    };
    setDefaultElements(updatedElements);
    setDraggingIndex(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !thumbnail || defaultElements.length === 0) {
      setError('Please fill all required fields and add at least one element');
      return;
    }
    try {
      setIsLoading(true);
      const mapData = {
        name,
        thumbnail,
        dimensions: `${width}x${height}`,
        defaultElement: defaultElements,
      };
      const response = mapId
        ? await api.put(`/admin/map/${mapId}`, mapData, {
          headers: { authorization: `Bearer ${token}` },
        })
        : await adminAPI.createMap(mapData.thumbnail, mapData.dimensions, mapData.name, mapData.defaultElement);
      setMessage(mapId ? 'Map updated!' : 'Map created!');
      setTimeout(() => router.push('/admin/maps'), 2000);
      setIsLoading(false);
    } catch {
      setError('Failed to save map');
      setIsLoading(false);
    }
  };

  const getElementById = (id: string) => availableElements.find(elem => elem.id === id);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="w-[280px] border-r overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Elements</h2>
        <div className="grid grid-cols-2 gap-2">
          {availableElements.map((element) => (
            <div
              key={element.id}
              className={`p-2 border rounded cursor-pointer ${selectedElement === element.id ? 'border-blue-500' : ''}`}
              onClick={() => setSelectedElement(element.id)}
            >
              <img src={element.imageUrl} className="w-full h-16 object-contain" alt="" />
              <p className="text-xs text-center mt-1">{element.width}x{element.height}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={gridRef}
          className="absolute inset-0 bg-gray-50"
          style={{
            width: width * TILE_SIZE,
            height: height * TILE_SIZE,
            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
            backgroundImage:
              'linear-gradient(to right, #ccc 1px, transparent 1px), linear-gradient(to bottom, #ccc 1px, transparent 1px)',
          }}
          onClick={handleGridClick}
          onDrop={handleDropOnGrid}
          onDragOver={handleDragOver}
        >
          {defaultElements.map((elem, index) => {
            const element = getElementById(elem.elementId);
            if (!element) return null;
            return (
              <Dialog key={index} modal>
                <div
                  className="absolute border border-blue-400 cursor-move"
                  style={{
                    top: elem.y * TILE_SIZE,
                    left: elem.x * TILE_SIZE,
                    width: element.width * TILE_SIZE,
                    height: element.height * TILE_SIZE,
                  }}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementIndex(index);
                  }}
                >
                  <DialogTrigger asChild>
                    <img src={element.imageUrl} alt="" className="w-full h-full object-contain" />
                  </DialogTrigger>
                </div>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Element</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <input
                      type="number"
                      placeholder="X"
                      value={elem.x}
                      onChange={(e) => updateDefaultElement(index, { ...elem, x: Number(e.target.value) })}
                      className="w-full border p-2 rounded"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={elem.y}
                      onChange={(e) => updateDefaultElement(index, { ...elem, y: Number(e.target.value) })}
                      className="w-full border p-2 rounded"
                    />
                    <Button variant="destructive" onClick={() => removeDefaultElement(index)}>
                      Remove
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>

        <div className="absolute top-4 right-4 z-10">
          <Dialog>
            <DialogTrigger asChild>
              <Button>{mapId ? 'Edit Map' : 'Create Map'}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{mapId ? 'Edit Map' : 'Create New Map'}</DialogTitle>
              </DialogHeader>
              {error && <div className="text-red-600 mb-2">{error}</div>}
              {message && <div className="text-green-600 mb-2">{message}</div>}
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Map Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border p-2 rounded"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Thumbnail URL"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    className="w-full border p-2 rounded mt-2"
                    required
                  />
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      placeholder="Width"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      className="border p-2 rounded w-full"
                    />
                    <input
                      type="number"
                      placeholder="Height"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="border p-2 rounded w-full"
                    />
                  </div>
                  <Button type="submit" className="mt-4 w-full" disabled={isLoading}>
                    {isLoading ? 'Saving...' : mapId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default MapEditor;
