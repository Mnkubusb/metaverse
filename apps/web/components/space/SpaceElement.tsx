import React from 'react';

export type spaceElement = {
    id: string;
    elementId: string;
    spaceId: string;
    x: number;
    y: number;
    imageUrl: string;
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
        width: `${element.x * 32}px`,
        height: `${element.y * 32}px`,
      }}
    >
      <img 
        src={element.imageUrl}
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
