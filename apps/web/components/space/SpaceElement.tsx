import React from 'react';

export type elementLayer = "floor" | "wall" | "objects" | "topObjects";

export type spaceElement = {
    id: string;
    element: {
        id: string;
        imageUrl: string;
        width: number;
        height: number;
        static: boolean;
        layer?: elementLayer;
    }
    x: number;
    y: number;
    // which area of the space it's in ("main" = outdoors); older spaces may omit it
    area?: string;
    // a door: stepping on it moves you to this tile of that area
    to?: { area: string; x: number; y: number } | null;
};

const SpaceElement = ({ element, onRemove } : {
    element: spaceElement;
    onRemove?: (id: string) => void;
}) => {
  return (
    <div 
      className="absolute"
      style={{
        left: `${element.x * 32}px`,
        top: `${element.y * 32}px`,
        width: `${element.element.width * 32}px`,
        height: `${element.element.height * 32}px`,
      }}
    >
      <img 
        src={element.element.imageUrl}
        alt={`Element at ${element.x},${element.y}`}
        className="w-full h-full object-contain"
      />
      
      {onRemove && (
        <button 
          onClick={() => onRemove(element.id)}
          className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
          title="Remove element"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default SpaceElement;
