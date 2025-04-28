/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import api, { adminAPI, elementAPI } from "../../lib/api";
import { useAuth } from "../../contexts/authContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

  const [name, setName] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  const [availableElements, setAvailableElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [defaultElements, setDefaultElements] = useState<DefaultElement[]>([]);
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const gridRef = useRef<HTMLCanvasElement>(null);
  const imagesCache = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const fetchElements = async () => {
      try {
        setIsLoading(true);
        const response = await elementAPI.getElements();
        if (response.data?.elements) {
          setAvailableElements(response.data.elements);

          // Preload images
          const newCache = new Map<string, HTMLImageElement>();
          for (const element of response.data.elements) {
            const img = new Image();
            img.src = element.imageUrl;
            newCache.set(element.id, img);
          }
          imagesCache.current = newCache;
        }
      } catch {
        setError("Failed to load elements");
      } finally {
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
          const { name, thumbnail, dimensions, elements } = response.data;
          setName(name);
          setThumbnail(thumbnail);
          const [w, h] = dimensions.split('x').map(Number);
          setWidth(w);
          setHeight(h);
          setDefaultElements(elements.map((el: any) => ({ ...el, elementId: el.element?.id })) || []);
        } catch {
          setError("Failed to load map data");
        } finally {
          setIsLoading(false);
        }
      };

      fetchMapData();
    }
  }, [mapId, token]);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width * TILE_SIZE, height * TILE_SIZE);

    ctx.fillStyle = "#f9fafb"; // background color
    ctx.fillRect(0, 0, width * TILE_SIZE, height * TILE_SIZE);

    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_SIZE, 0);
      ctx.lineTo(x * TILE_SIZE, height * TILE_SIZE);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_SIZE);
      ctx.lineTo(width * TILE_SIZE, y * TILE_SIZE);
      ctx.stroke();
    }

    for (const elem of defaultElements) {
      const img = imagesCache.current.get(elem.elementId);
      const elementDef = availableElements.find(e => e.id === elem.elementId);
      if (img && elementDef) {
        ctx.drawImage(
          img,
          elem.x * TILE_SIZE,
          elem.y * TILE_SIZE,
          elementDef.width * TILE_SIZE,
          elementDef.height * TILE_SIZE
        );
      }
    }
  }, [defaultElements, availableElements, width, height]);

  useEffect(() => {
    const canvas = gridRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawGrid(ctx);
  }, [drawGrid]);

  const handleGridClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedElement) return;
    const rect = gridRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    setDefaultElements(prev => [...prev, { elementId: selectedElement, x, y }]);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = gridRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const clickedIndex = defaultElements.findIndex(
      elem => elem.x === x && elem.y === y
    );

    if (clickedIndex !== -1) {
      setDraggingIndex(clickedIndex);
      setSelectedElementIndex(clickedIndex);
    }
  };

  const handleMouseUp = () => {
    setDraggingIndex(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingIndex === null) return;
    const rect = gridRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    setDefaultElements(prev => {
      const updated = [...prev];
      updated[draggingIndex] = { ...updated[draggingIndex], x, y, elementId: updated[draggingIndex]?.elementId as string };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !thumbnail || defaultElements.length === 0) {
      setError("Please fill all fields and add elements");
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

      if (mapId) {
        await api.put(`/admin/map/${mapId}`, mapData, {
          headers: { authorization: `Bearer ${token}` },
        });
        setMessage("Map updated!");
      } else {
        await adminAPI.createMap(mapData.thumbnail, mapData.dimensions, mapData.name, mapData.defaultElement);
        setMessage("Map created!");
      }

      setTimeout(() => router.push("/admin/maps"), 1500);
    } catch {
      setError("Failed to save map");
    } finally {
      setIsLoading(false);
    }
  };

  const removeElement = (index: number) => {
    setDefaultElements(prev => prev.filter((_, i) => i !== index));
    setSelectedElementIndex(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="w-[280px] border-r overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Elements</h2>
        <div className="grid grid-cols-2 gap-2">
          {availableElements.map((element) => (
            <div
              key={element.id}
              className={`p-2 border rounded cursor-pointer ${selectedElement === element.id ? "border-blue-500" : ""}`}
              onClick={() => setSelectedElement(element.id)}
            >
              <img src={element.imageUrl} alt="" className="w-full h-16 object-contain" />
              <p className="text-xs text-center">{element.width}x{element.height}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 relative">
        <canvas
          ref={gridRef}
          width={width * TILE_SIZE}
          height={height * TILE_SIZE}
          className="absolute inset-0 bg-gray-50"
          onClick={handleGridClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        />

        <div className="absolute top-4 right-4 z-10">
          <Dialog>
            <DialogTrigger asChild>
              <Button>{mapId ? "Edit Map" : "Create Map"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{mapId ? "Edit Map" : "Create New Map"}</DialogTitle>
              </DialogHeader>

              {error && <p className="text-red-600 mb-2">{error}</p>}
              {message && <p className="text-green-600 mb-2">{message}</p>}

              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Map Name"
                    required
                    className="w-full border p-2 rounded"
                  />
                  <input
                    type="text"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    placeholder="Thumbnail URL"
                    required
                    className="w-full border p-2 rounded mt-2"
                  />
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      placeholder="Width"
                      className="border p-2 rounded w-full"
                    />
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      placeholder="Height"
                      className="border p-2 rounded w-full"
                    />
                  </div>
                  <Button type="submit" className="mt-4 w-full" disabled={isLoading}>
                    {isLoading ? "Saving..." : mapId ? "Update" : "Create"}
                  </Button>
                </div>
              </form>

              {selectedElementIndex !== null && (
                <div className="col-span-2">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => removeElement(selectedElementIndex)}
                  >
                    Remove Selected Element
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default MapEditor;
