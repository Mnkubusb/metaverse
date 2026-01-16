import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { DndContext } from '@dnd-kit/core';

export type Element = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  static: boolean;
  layer : string;
};


export const DraggableElementCard = ({ element }: { element: Element }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: element.id,
    data: element,
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      whileHover={{ scale: 1.03 }}
      style={{
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
      }}
      className="cursor-grab rounded-xl bg-white/70 backdrop-blur border p-3 shadow hover:shadow-lg transition"
    >
      <img
        src={element.imageUrl}
        className="h-24 w-full object-contain mb-2"
      />
      <p className="text-sm text-gray-700">
        {element.width} × {element.height}
      </p>
    </motion.div>
  );
};

import { useDroppable } from '@dnd-kit/core';
import { adminAPI, elementAPI, spaceAPI } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/authContext';

export const DropCanvas = ({ onDrop }: { onDrop: (el: Element) => void }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-72 rounded-2xl border-2 border-dashed flex items-center justify-center transition
        ${isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
    >
      <p className="text-gray-500">
        Drag elements here to add
      </p>
    </div>
  );
};

const ElementManager = () => {
  const { token } = useAuth();
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingElement, setEditingElement] = useState<Element | null>(null);

  useEffect(() => {
    fetchElements();
  }, []);

  const fetchElements = async () => {
    setLoading(true);
    const res = await elementAPI.getElements();
    setElements(res.data.elements);
    setLoading(false);
  };

  const handleDragEnd = async (event: any) => {
    if (event.over?.id === 'canvas') {
      const el = event.active.data.current as Element;

      await adminAPI.createElement(
        el.imageUrl,
        el.width,
        el.height,
        el.static,
        el.layer
      );

      fetchElements();
    }
  };

  const handleDeleteElement = async (elementId: string) => {
    try {
      setLoading(true);
      await spaceAPI.deleteElement(elementId);

      // Remove the element from the local state
      const updatedElements = elements.filter((element: Element) => element.id !== elementId);
      setElements(updatedElements);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold mb-6"
        >
          🧩 Element Manager
        </motion.h1>

        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Library */}
          <div className="bg-white rounded-2xl p-4 shadow">
            <h2 className="font-semibold mb-4">Element Library</h2>
            <div className="grid grid-cols-2 gap-3">
              {elements.map((el: Element) => (
                <DraggableElementCard key={el.id} element={el} />
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow">
            <h2 className="font-semibold mb-4">Canvas</h2>
            <DropCanvas onDrop={() => { }} />
          </div>
        </div>

        {/* Elements List */}
        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="font-semibold mb-4">All Elements</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {elements.map(el => (
              <motion.div
                key={el.id}
                whileHover={{ scale: 1.02 }}
                className="rounded-xl border p-4 hover:shadow-md"
              >
                <img
                  src={el.imageUrl}
                  className="h-32 mx-auto object-contain mb-3"
                />
                <div className="text-sm text-gray-700">
                  <p>ID: {el.id}</p>
                  <p>Size: {el.width}×{el.height}</p>
                  <p>{el.static ? 'Static' : 'Movable'}</p>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setEditingElement(el)}
                    className="flex-1 rounded-lg bg-yellow-400 text-white py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteElement(el.id)}
                    className="flex-1 rounded-lg bg-red-500 text-white py-1"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default ElementManager;


