export interface ElementPosition {
    elementId: string;
    x: number;
    y: number;
  }
  
  export interface Map {
    id: string;
    name: string;
    thumbnail: string;
    dimensions: string;
    defaultElement: ElementPosition[];
  }
  
  export interface MapCreatePayload {
    name: string;
    thumbnail: string;
    dimensions: string;
    defaultElement: ElementPosition[];
  }
  
  export interface MapResponse {
    id: string;
    name: string;
    thumbnail: string;
    dimensions: string;
    defaultElement: ElementPosition[];
  }
  
  export interface MapsResponse {
    maps: Map[];
  }