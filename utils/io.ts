import { NodeData, Connection, FrameData, Prefab } from '../types';

export interface DiagramData {
  version: number;
  timestamp: number;
  nodes: NodeData[];
  edges: Connection[];
  frames: FrameData[];
}

// Robust Base64 encoding that handles Unicode characters
export const encodeData = (data: any): string => {
  const json = JSON.stringify(data);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g,
      function toSolidBytes(match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
      })
  );
};

// Robust Base64 decoding with fallback
export const decodeData = (str: string): any => {
  try {
    // Method 1: Decode assuming URI component encoding (matches encodeData)
    const json = decodeURIComponent(
      atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
    return JSON.parse(json);
  } catch (e) {
    // Method 2: Fallback to standard Base64 decode (for legacy or external strings)
    try {
        const simpleJson = atob(str);
        return JSON.parse(simpleJson);
    } catch (e2) {
        console.error("Failed to decode string", e, e2);
        return null;
    }
  }
};

export const generateDiagramString = (nodes: NodeData[], edges: Connection[], frames: FrameData[]): string => {
  const data: DiagramData = {
    version: 1,
    timestamp: Date.now(),
    nodes,
    edges,
    frames
  };
  return `MF_DIAGRAM:${encodeData(data)}`;
};

export const generatePrefabString = (prefab: Prefab): string => {
  // Strip ID for clean import
  const { id, ...rest } = prefab;
  return `MF_MACHINE:${encodeData(rest)}`;
};

export const parseImportString = (str: string): { type: 'diagram' | 'machine' | 'error', data: any } => {
  const cleanStr = str.trim();
  
  if (cleanStr.startsWith('MF_DIAGRAM:')) {
    const payload = cleanStr.substring('MF_DIAGRAM:'.length);
    const data = decodeData(payload);
    return data ? { type: 'diagram', data } : { type: 'error', data: null };
  }
  
  if (cleanStr.startsWith('MF_MACHINE:')) {
    const payload = cleanStr.substring('MF_MACHINE:'.length);
    const data = decodeData(payload);
    return data ? { type: 'machine', data } : { type: 'error', data: null };
  }

  // Try raw JSON fallback
  try {
      const json = JSON.parse(cleanStr);
      if(json.nodes && json.edges) return { type: 'diagram', data: json };
      if(json.recipe) return { type: 'machine', data: json };
  } catch(e) {}

  return { type: 'error', data: null };
};