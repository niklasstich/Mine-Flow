import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { NodeEntity, InternalNodeStatus } from './NodeEntity';
import { ContextMenu } from './ContextMenu';
import { NodeContextMenu } from './NodeContextMenu';
import { FrameContextMenu } from './FrameContextMenu';
import { EdgeContextMenu } from './EdgeContextMenu';
import { SearchPalette } from './SearchPalette';
import { getEdgePath, snapToGrid, getEdgeCenter } from '../utils/geometry';
import { calculateFrameAggregation, getNodesInFrame, getFramesInFrame, FrameAggregation } from '../utils/frameUtils';
import { NodeData, Connection, DragItem, FlowState, Prefab, UnitDictionary, ClipboardData, FrameData, Blueprint } from '../types';
import { calculateFlows } from '../services/flowEngine';
import { Info, X, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface CanvasProps {
  nodes: NodeData[];
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  edges: Connection[];
  setEdges: React.Dispatch<React.SetStateAction<Connection[]>>;
  frames: FrameData[];
  setFrames: React.Dispatch<React.SetStateAction<FrameData[]>>;
  onEditNode: (node: NodeData) => void;
  onEditEdge: (edge: Connection) => void;
  onDuplicateNode: (nodeId: string) => void;
  onSaveToLibrary: (nodeId: string) => void;
  onSaveFrameToLibrary: (frameId: string) => void;
  onRenameFrame: (frameId: string) => void;
  onDeleteFrame: (frameId: string) => void;
  prefabs: Prefab[];
  unitDictionary: UnitDictionary;
  isOverlayOpen: boolean;
  onDeleteCustomPrefab: (id: string) => void;
  collapseFrames: boolean; // Control from App
  showEfficiency: boolean;
  // Selection Props
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedEdgeIds: Set<string>;
  setSelectedEdgeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFrameId: string | null;
  setSelectedFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  // History
  onCheckpoint: () => void;
}

// Helper to determine status color based on value (Matches NodeEntity logic)
const getStatusColor = (value: number): string => {
    if (value < 0.5) return "#FF5555"; // Red
    if (value < 0.9) return "#FFAA00"; // Gold
    if (value < 0.99) return "#FFFF55"; // Yellow
    if (value <= 1.01) return "#55FF55"; // Green
    if (value <= 1.5) return "#FFFF55"; // Yellow
    if (value <= 2.0) return "#FFAA00"; // Gold
    return "#FF5555"; // Red
};

// Determine "worst" metrics for a group of nodes
const calculateWorstMetrics = (nodes: NodeData[], flowState: FlowState): { worstSat: number, worstOutputRatio: number } => {
    if (nodes.length === 0) return { worstSat: 1.0, worstOutputRatio: 1.0 };
    
    // Saturation Logic
    let worstSeverity = -1;
    let worstSat = 1.0;
    const getSeverity = (sat: number) => {
        if (sat < 0.5 || sat > 2.0) return 3; // Red
        if (sat < 0.9 || sat > 1.5) return 2; // Orange
        if (sat < 0.99 || sat > 1.01) return 1; // Yellow
        return 0; // Green
    };
    nodes.forEach(n => {
        const sat = flowState.nodeRates[n.id]?.saturation ?? 1.0;
        if (n.recipe.inputs.length === 0) return; // Ignore generators for input health
        const sev = getSeverity(sat);
        if (sev > worstSeverity) {
            worstSeverity = sev;
            worstSat = sat;
        } else if (sev === worstSeverity && Math.abs(sat - 1.0) > Math.abs(worstSat - 1.0)) {
            worstSat = sat;
        }
    });

    // Output Ratio Logic
    let worstOutSeverity = -1;
    let worstOutRatio = 1.0;
    const getOutSeverity = (r: number) => {
        if (r < 0.5) return 3;
        if (r < 0.9) return 2;
        if (r < 0.99) return 1;
        return 0;
    };
    nodes.forEach(n => {
        const r = flowState.nodeRates[n.id]?.outputFlowRatio ?? 1.0;
        if (n.recipe.outputs.length === 0) return; // Ignore sinks for output health
        const sev = getOutSeverity(r);
        if (sev > worstOutSeverity) {
            worstOutSeverity = sev;
            worstOutRatio = r;
        } else if (sev === worstOutSeverity && r < worstOutRatio) {
            worstOutRatio = r;
        }
    });

    return { 
        worstSat: worstSat,
        worstOutputRatio: worstOutRatio
    };
};

export const Canvas: React.FC<CanvasProps> = ({ 
    nodes, setNodes, edges, setEdges, frames, setFrames,
    onEditNode, onEditEdge, onDuplicateNode, onSaveToLibrary, onSaveFrameToLibrary, onRenameFrame, onDeleteFrame,
    prefabs, unitDictionary, isOverlayOpen,
    onDeleteCustomPrefab, collapseFrames, showEfficiency,
    selectedNodeIds, setSelectedNodeIds, selectedEdgeIds, setSelectedEdgeIds, selectedFrameId, setSelectedFrameId,
    onCheckpoint
}) => {
  // Selection State (Moved to Props)
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  
  // Clipboard
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Interaction State
  const [dragItem, setDragItem] = useState<DragItem>(null);
  const [pendingConnection, setPendingConnection] = useState<{ sourceId: string; socketIdx: number; isInput: boolean } | null>(null);
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [frameContextMenu, setFrameContextMenu] = useState<{ x: number; y: number; frameId: string } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastMousePosRef = useRef<{x: number, y: number} | null>(null);

  // --- Dynamic Frame Aggregation (Memoized) ---
  const frameAggregation = useMemo(() => {
    // ONLY collapse if explicitly requested by the button
    if (!collapseFrames) return null;

    const frameMap: Record<string, NodeData> = {};
    const hiddenNodeIds = new Set<string>();
    const nodeToFrameId = new Map<string, string>();
    const edgeRemap: Record<string, { frameId: string, socketIdx: number }> = {}; 
    const reverseMaps: Record<string, FrameAggregation> = {};

    frames.forEach(frame => {
        const agg = calculateFrameAggregation(frame, nodes, edges);
        reverseMaps[frame.id] = agg;
        
        agg.internalNodeIds.forEach(id => {
            hiddenNodeIds.add(id);
            nodeToFrameId.set(id, frame.id);
        });
        
        const pseudoNode: NodeData = {
            id: frame.id,
            x: frame.x,
            y: frame.y,
            label: frame.label,
            recipe: agg.recipe,
            width: frame.w,
            height: frame.h
        };
        frameMap[frame.id] = pseudoNode;

        Object.entries(agg.inputMap).forEach(([key, newIdx]) => {
            edgeRemap[`in-${key}`] = { frameId: frame.id, socketIdx: newIdx };
        });
        Object.entries(agg.outputMap).forEach(([key, newIdx]) => {
            edgeRemap[`out-${key}`] = { frameId: frame.id, socketIdx: newIdx };
        });
    });

    return { frameMap, hiddenNodeIds, nodeToFrameId, edgeRemap, reverseMaps };
  }, [nodes, edges, frames, collapseFrames]); 

  // Optimize Flow Calculation: Dependencies must not include x/y coords to prevent recalc on drag
  const flowState: FlowState = useMemo(() => {
    return calculateFlows(nodes, edges, unitDictionary);
  }, [
    edges, 
    unitDictionary, 
    // Create a stable dependency key based on node IDs and recipes only
    JSON.stringify(nodes.map(n => ({ id: n.id, recipe: n.recipe })))
  ]);

  const sortedFrames = useMemo(() => {
    return [...frames].sort((a, b) => (b.w * b.h) - (a.w * a.h));
  }, [frames]);

  // --- Helpers ---

  const getCanvasCoords = (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
          x: (clientX - rect.left - pan.x) / zoom,
          y: (clientY - rect.top - pan.y) / zoom
      };
  };

  const centerOnNode = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // Calculate pan to center the node
      // Canvas logic: transform = translate(pan.x, pan.y) scale(zoom)
      // ScreenCenter = (node.x * zoom) + pan.x
      // pan.x = ScreenCenter - (node.x * zoom)
      
      const screenCenterX = rect.width / 2;
      const screenCenterY = rect.height / 2;
      
      const newPanX = screenCenterX - (node.x + (node.width||220)/2) * zoom;
      const newPanY = screenCenterY - (node.y + (node.height||150)/2) * zoom;
      
      setPan({ x: newPanX, y: newPanY });
      setSelectedNodeIds(new Set([nodeId]));
      setSelectedFrameId(null);
  };

  // --- Logic for Actions ---

  const performCopy = useCallback(() => {
    let nodesToCopy: NodeData[] = [];
    nodesToCopy = nodes.filter(n => selectedNodeIds.has(n.id));
    
    // If a frame is selected, copy contents
    if (selectedFrameId) {
       // Logic for frame copy could be complex, for now copy focused frame logic is tricky without explicit node selection
       // Simply ignore frame copy for clipboard shortcut for now, or implement frame copy later
    }

    if (nodesToCopy.length === 0) return;
    const ids = new Set(nodesToCopy.map(n => n.id));
    const edgesToCopy = edges.filter(e => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId));
    setClipboard({ nodes: nodesToCopy, edges: edgesToCopy });
  }, [nodes, edges, selectedNodeIds, selectedFrameId]);

  const performDelete = useCallback(() => {
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0 && !selectedFrameId) return;
    
    onCheckpoint();

    if (selectedFrameId) {
        onDeleteFrame(selectedFrameId);
        setSelectedFrameId(null);
        return; // Frame delete handles its own confirm logic, but we called checkpoint already
    }

    const idsToDelete = new Set([...selectedNodeIds]);
    setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
    setEdges(prev => prev.filter(e => 
        !idsToDelete.has(e.sourceNodeId) && 
        !idsToDelete.has(e.targetNodeId) && 
        !selectedEdgeIds.has(e.id)
    ));
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
  }, [selectedNodeIds, selectedEdgeIds, selectedFrameId, onDeleteFrame, onCheckpoint]);

  const performPaste = useCallback(() => {
      if (!clipboard) return;
      // Paste at mouse center or screen center?
      // For shortcuts, screen center is safer if mouse position isn't tracked globally
      const rect = canvasRef.current?.getBoundingClientRect();
      const centerX = rect ? (rect.width/2 - pan.x)/zoom : 0;
      const centerY = rect ? (rect.height/2 - pan.y)/zoom : 0;

      onCheckpoint();

      const { nodes: clipNodes, edges: clipEdges } = clipboard;
      if(clipNodes.length === 0) return;
      const minX = Math.min(...clipNodes.map(n => n.x));
      const minY = Math.min(...clipNodes.map(n => n.y));
      
      const idMap = new Map<string, string>();
      const newNodes = clipNodes.map(n => {
          const newId = crypto.randomUUID();
          idMap.set(n.id, newId);
          return {
              ...n,
              id: newId,
              x: n.x - minX + centerX,
              y: n.y - minY + centerY,
              recipe: {
                  ...n.recipe,
                  inputs: n.recipe.inputs.map(i => ({...i, id: crypto.randomUUID()})),
                  outputs: n.recipe.outputs.map(o => ({...o, id: crypto.randomUUID()}))
              }
          };
      });
      const newEdges = clipEdges.map(e => ({
          ...e,
          id: crypto.randomUUID(),
          sourceNodeId: idMap.get(e.sourceNodeId)!,
          targetNodeId: idMap.get(e.targetNodeId)!
      }));
      setNodes(prev => [...prev, ...newNodes]);
      setEdges(prev => [...prev, ...newEdges]);
      setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
  }, [clipboard, pan, zoom, onCheckpoint]);

  const performDuplicate = useCallback(() => {
      if (selectedNodeIds.size === 0) return;
      
      onCheckpoint();
      
      const nodesToDup = nodes.filter(n => selectedNodeIds.has(n.id));
      const idMap = new Map<string, string>();
      const newNodes = nodesToDup.map(n => {
          const newId = crypto.randomUUID();
          idMap.set(n.id, newId);
          // Deep copy recipe
          const newRecipe = JSON.parse(JSON.stringify(n.recipe));
          newRecipe.inputs = newRecipe.inputs.map((i: any) => ({ ...i, id: crypto.randomUUID() }));
          newRecipe.outputs = newRecipe.outputs.map((o: any) => ({ ...o, id: crypto.randomUUID() }));

          return {
              ...n,
              id: newId,
              x: n.x + 20,
              y: n.y + 20,
              label: `${n.label} (Copy)`,
              recipe: newRecipe
          };
      });

      setNodes(prev => [...prev, ...newNodes]);
      setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
  }, [nodes, selectedNodeIds, onCheckpoint]);


  // --- Keyboard Listeners ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isOverlayOpen || isSearchOpen) return;
        
        // Input protection
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        // Copy
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            performCopy();
        }
        // Paste
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            performPaste();
        }
        // Duplicate
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault(); // Prevent bookmark
            performDuplicate();
        }
        // Delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
            performDelete();
        }
        // Search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault(); // Prevent browser search focus
            setIsSearchOpen(true);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlayOpen, isSearchOpen, performCopy, performPaste, performDelete, performDuplicate]);


  // --- Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const wheelDelta = -e.deltaY;
    const zoomFactor = Math.pow(1.001, wheelDelta);
    let newZoom = zoom * zoomFactor;
    newZoom = Math.max(0.1, Math.min(newZoom, 5)); 
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
        e.preventDefault();
        setDragItem({ 
            type: 'pan', 
            startX: e.clientX, 
            startY: e.clientY, 
            initialPan: { ...pan } 
        });
        return;
    }
    if (e.button === 0) {
        if (contextMenu) setContextMenu(null);
        if (nodeContextMenu) setNodeContextMenu(null);
        if (frameContextMenu) setFrameContextMenu(null);
        if (edgeContextMenu) setEdgeContextMenu(null);
        if (pendingConnection) setPendingConnection(null);

        if (e.target === canvasRef.current) {
            const coords = getCanvasCoords(e.clientX, e.clientY);
            setDragItem({ type: 'selection_box', startX: coords.x, startY: coords.y });
            if (!e.shiftKey) {
                setSelectedNodeIds(new Set());
                setSelectedEdgeIds(new Set());
                setSelectedFrameId(null);
            }
        }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pendingConnection) {
        setPendingConnection(null); 
        return;
    }
    if (dragItem?.type === 'pan') return;
    if (nodeContextMenu) setNodeContextMenu(null);
    if (frameContextMenu) setFrameContextMenu(null);
    if (edgeContextMenu) setEdgeContextMenu(null);
    const coords = getCanvasCoords(e.clientX, e.clientY);
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX: coords.x, canvasY: coords.y });
  };

  const handleNodeContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (contextMenu) setContextMenu(null);
    if (frameContextMenu) setFrameContextMenu(null);
    if (edgeContextMenu) setEdgeContextMenu(null);
    if (pendingConnection) setPendingConnection(null);

    if (frameAggregation && frameAggregation.frameMap[nodeId]) {
         setFrameContextMenu({ x: e.clientX, y: e.clientY, frameId: nodeId });
         return;
    }

    if (!selectedNodeIds.has(nodeId)) {
        setSelectedNodeIds(new Set([nodeId]));
    }
    setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  };

  const handleFrameContextMenu = (e: React.MouseEvent, frameId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (contextMenu) setContextMenu(null);
    if (nodeContextMenu) setNodeContextMenu(null);
    if (edgeContextMenu) setEdgeContextMenu(null);
    setFrameContextMenu({ x: e.clientX, y: e.clientY, frameId });
  };
  
  const handleEdgeContextMenu = (e: React.MouseEvent, edgeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (contextMenu) setContextMenu(null);
    if (nodeContextMenu) setNodeContextMenu(null);
    if (frameContextMenu) setFrameContextMenu(null);
    if (pendingConnection) setPendingConnection(null);
    
    setEdgeContextMenu({ x: e.clientX, y: e.clientY, edgeId });
  };

  const handleDeleteEdge = () => {
      if (!edgeContextMenu) return;
      onCheckpoint();
      setEdges(prev => prev.filter(e => e.id !== edgeContextMenu.edgeId));
      setEdgeContextMenu(null);
  };

  const handleEditEdgeAction = () => {
      if (!edgeContextMenu) return;
      const edge = edges.find(e => e.id === edgeContextMenu.edgeId);
      if (edge) onEditEdge(edge);
      setEdgeContextMenu(null);
  };

  const handleAddPrefab = (prefab: Prefab, position?: { x: number, y: number }) => {
    onCheckpoint();
    let targetX = 0;
    let targetY = 0;
    if (position) {
        targetX = position.x;
        targetY = position.y;
    } else if (contextMenu) {
        targetX = contextMenu.canvasX;
        targetY = contextMenu.canvasY;
    } else {
        return;
    }
    const newRecipe = JSON.parse(JSON.stringify(prefab.recipe));
    newRecipe.inputs = newRecipe.inputs.map((i: any) => ({ ...i, id: crypto.randomUUID() }));
    newRecipe.outputs = newRecipe.outputs.map((o: any) => ({ ...o, id: crypto.randomUUID() }));
    const newNode: NodeData = {
      id: crypto.randomUUID(),
      x: snapToGrid(targetX),
      y: snapToGrid(targetY),
      label: prefab.label,
      recipe: newRecipe
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeIds(new Set([newNode.id]));
    setContextMenu(null);
  };

  const handleAddBlueprint = (blueprint: Blueprint, position: { x: number, y: number }) => {
     if (blueprint.nodes.length === 0) return;
     onCheckpoint();
     const minX = Math.min(...blueprint.nodes.map(n => n.x));
     const minY = Math.min(...blueprint.nodes.map(n => n.y));
     const offsetX = position.x - minX;
     const offsetY = position.y - minY;
     const idMap = new Map<string, string>(); 
     
     const newNodes: NodeData[] = blueprint.nodes.map(n => {
         const newId = crypto.randomUUID();
         idMap.set(n.id, newId);
         const newRecipe = JSON.parse(JSON.stringify(n.recipe));
         newRecipe.inputs = newRecipe.inputs.map((i: any) => ({ ...i, id: crypto.randomUUID() }));
         newRecipe.outputs = newRecipe.outputs.map((o: any) => ({ ...o, id: crypto.randomUUID() }));
         return {
             ...n,
             id: newId,
             x: snapToGrid(n.x + offsetX),
             y: snapToGrid(n.y + offsetY),
             recipe: newRecipe
         };
     });
     
     const newEdges: Connection[] = blueprint.edges.map(e => ({
         ...e,
         id: crypto.randomUUID(),
         sourceNodeId: idMap.get(e.sourceNodeId)!,
         targetNodeId: idMap.get(e.targetNodeId)!
     }));
     
     let newFrames: FrameData[] = [];
     if (blueprint.frames) {
         newFrames = blueprint.frames.map(f => ({
             ...f,
             id: crypto.randomUUID(),
             x: snapToGrid(f.x + offsetX),
             y: snapToGrid(f.y + offsetY)
         }));
     }

     setNodes(prev => [...prev, ...newNodes]);
     setEdges(prev => [...prev, ...newEdges]);
     setFrames(prev => [...prev, ...newFrames]);
     setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
  }

  const handleAddFrame = () => {
      if (!contextMenu) return;
      onCheckpoint();
      const newFrame: FrameData = {
          id: crypto.randomUUID(),
          label: "New Frame",
          x: snapToGrid(contextMenu.canvasX),
          y: snapToGrid(contextMenu.canvasY),
          w: 600,
          h: 400,
          color: '#93c5fd'
      };
      setFrames(prev => [...prev, newFrame]);
      setSelectedFrameId(newFrame.id);
      setContextMenu(null);
  };

  const handleCopy = () => {
      if(!nodeContextMenu) return;
      performCopy();
      setNodeContextMenu(null);
  };

  const handleCut = () => {
      if(!nodeContextMenu) return;
      performCopy();
      performDelete();
      setNodeContextMenu(null);
  };

  const handleDelete = () => {
      if(!nodeContextMenu) return;
      performDelete();
      setNodeContextMenu(null);
  }
  
  const handleDeleteFrame = () => {
      if (!frameContextMenu) return;
      onCheckpoint(); // Explicit checkpoint for frame deletion via context menu
      onDeleteFrame(frameContextMenu.frameId);
      setFrameContextMenu(null);
  }

  const handlePaste = () => {
      if(!clipboard || !contextMenu) return;
      
      onCheckpoint();

      const { nodes: clipNodes, edges: clipEdges } = clipboard;
      if(clipNodes.length === 0) return;
      const minX = Math.min(...clipNodes.map(n => n.x));
      const minY = Math.min(...clipNodes.map(n => n.y));
      const targetX = snapToGrid(contextMenu.canvasX);
      const targetY = snapToGrid(contextMenu.canvasY);
      const idMap = new Map<string, string>();
      const newNodes = clipNodes.map(n => {
          const newId = crypto.randomUUID();
          idMap.set(n.id, newId);
          return {
              ...n,
              id: newId,
              x: n.x - minX + targetX,
              y: n.y - minY + targetY,
              recipe: {
                  ...n.recipe,
                  inputs: n.recipe.inputs.map(i => ({...i, id: crypto.randomUUID()})),
                  outputs: n.recipe.outputs.map(o => ({...o, id: crypto.randomUUID()}))
              }
          };
      });
      const newEdges = clipEdges.map(e => ({
          ...e,
          id: crypto.randomUUID(),
          sourceNodeId: idMap.get(e.sourceNodeId)!,
          targetNodeId: idMap.get(e.targetNodeId)!
      }));
      setNodes(prev => [...prev, ...newNodes]);
      setEdges(prev => [...prev, ...newEdges]);
      setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
      setContextMenu(null);
  }

  const handleFrameMouseDown = (e: React.MouseEvent, frameId: string) => {
      if (frameAggregation && frameAggregation.frameMap[frameId]) return;
      e.stopPropagation();
      if (e.button !== 0) return;
      const coords = getCanvasCoords(e.clientX, e.clientY);
      lastMousePosRef.current = { x: coords.x, y: coords.y };
      setSelectedFrameId(frameId);
      setSelectedNodeIds(new Set()); 
      setDragItem({ type: 'frame', id: frameId, startX: coords.x, startY: coords.y });
  };

  const handleFrameResizeStart = (e: React.MouseEvent, frame: FrameData, handle: string) => {
      e.stopPropagation();
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setDragItem({
          type: 'resize_frame',
          id: frame.id,
          handle,
          startX: coords.x,
          startY: coords.y,
          startW: frame.w,
          startH: frame.h,
          startFrameX: frame.x,
          startFrameY: frame.y
      });
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (contextMenu) setContextMenu(null);
    if (nodeContextMenu) setNodeContextMenu(null);
    if (frameContextMenu) setFrameContextMenu(null);
    if (edgeContextMenu) setEdgeContextMenu(null);
    if (pendingConnection) return; 

    if (e.button === 0) {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      lastMousePosRef.current = { x: coords.x, y: coords.y };
      if (frameAggregation && frameAggregation.frameMap[id]) {
          setSelectedFrameId(id);
          setSelectedNodeIds(new Set()); 
          setDragItem({ type: 'frame', id, startX: coords.x, startY: coords.y });
          return;
      }
      if (e.ctrlKey || e.shiftKey) {
          const newSet = new Set(selectedNodeIds);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setSelectedNodeIds(newSet);
          setDragItem({ type: 'node', id, startX: coords.x, startY: coords.y });
      } else {
          if (!selectedNodeIds.has(id)) {
            setSelectedNodeIds(new Set([id]));
            setSelectedEdgeIds(new Set()); // Explicitly clear edge selection on single node click
          }
          setDragItem({ type: 'node', id, startX: coords.x, startY: coords.y });
      }
    }
  };

  const handleSocketMouseDown = (e: React.MouseEvent, nodeId: string, socketIdx: number, isInput: boolean) => {
    e.stopPropagation();
    e.preventDefault(); 
    if (contextMenu) setContextMenu(null);
    if (nodeContextMenu) setNodeContextMenu(null);
    if (frameContextMenu) setFrameContextMenu(null);
    if (edgeContextMenu) setEdgeContextMenu(null);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY }; 
    if (pendingConnection) {
        completeConnection(nodeId, socketIdx, isInput);
    } else {
        setDragItem({ type: 'connection', sourceId: nodeId, socketIdx, isInput });
    }
  };

  const handleSocketMouseUp = (e: React.MouseEvent, nodeId: string, socketIdx: number, isInput: boolean) => {
    e.stopPropagation();
    if (dragItem?.type === 'connection') {
        const dist = Math.hypot(e.clientX - (lastMousePosRef.current?.x||0), e.clientY - (lastMousePosRef.current?.y||0));
        if (dist < 5 && dragItem.sourceId === nodeId && dragItem.socketIdx === socketIdx && dragItem.isInput === isInput) {
            setPendingConnection({ sourceId: nodeId, socketIdx, isInput });
            setDragItem(null);
            return;
        }
        completeConnection(nodeId, socketIdx, isInput);
    }
    setDragItem(null);
  };

  const completeConnection = (targetId: string, targetIdx: number, targetIsInput: boolean) => {
    const source = dragItem?.type === 'connection' ? dragItem : pendingConnection;
    if (!source) return;
    if (source.sourceId === targetId) {
        if (pendingConnection) setPendingConnection(null); 
        return;
    }
    if (source.isInput === targetIsInput) {
        if (pendingConnection) setPendingConnection(null);
        return;
    }
    let outputId = !source.isInput ? source.sourceId : targetId;
    let outputIdx = !source.isInput ? source.socketIdx : targetIdx;
    let inputId = source.isInput ? source.sourceId : targetId;
    let inputIdx = source.isInput ? source.socketIdx : targetIdx;

    if (frameAggregation) {
        if (frameAggregation.frameMap[outputId]) {
            const agg = frameAggregation.reverseMaps[outputId];
            if (agg && agg.reverseOutputMap[outputIdx]) {
                const real = agg.reverseOutputMap[outputIdx];
                outputId = real.nodeId;
                outputIdx = real.socketIdx;
            } else {
                setPendingConnection(null);
                return;
            }
        }
        if (frameAggregation.frameMap[inputId]) {
            const agg = frameAggregation.reverseMaps[inputId];
            if (agg && agg.reverseInputMap[inputIdx]) {
                 const real = agg.reverseInputMap[inputIdx];
                 inputId = real.nodeId;
                 inputIdx = real.socketIdx;
            } else {
                setPendingConnection(null);
                return;
            }
        }
    }

    const sourceNode = nodes.find(n => n.id === outputId);
    const targetNode = nodes.find(n => n.id === inputId);
    if (!sourceNode || !targetNode) return;
    const outputType = sourceNode.recipe.outputs[outputIdx]?.type || 'item';
    const inputType = targetNode.recipe.inputs[inputIdx]?.type || 'item';

    if (outputType !== inputType) {
        alert(`Cannot connect ${outputType} to ${inputType}`);
        setPendingConnection(null);
        return;
    }

    const exists = edges.some(edge => 
        edge.sourceNodeId === outputId && 
        edge.sourceSocketIdx === outputIdx && 
        edge.targetNodeId === inputId && 
        edge.targetSocketIdx === inputIdx
    );

    if (!exists) {
        onCheckpoint();
        setEdges(prev => [...prev, {
            id: crypto.randomUUID(),
            sourceNodeId: outputId,
            sourceSocketIdx: outputIdx,
            targetNodeId: inputId,
            targetSocketIdx: inputIdx,
            type: outputType,
            capacity: -1
        }]);
    }
    setPendingConnection(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    setMousePos(coords);
    if (!dragItem) return;

    if (dragItem.type === 'pan') {
        const dx = e.clientX - dragItem.startX;
        const dy = e.clientY - dragItem.startY;
        setPan({
            x: dragItem.initialPan.x + dx,
            y: dragItem.initialPan.y + dy
        });
        return;
    }

    if (dragItem.type === 'selection_box') {
        const x = Math.min(dragItem.startX, coords.x);
        const y = Math.min(dragItem.startY, coords.y);
        const w = Math.abs(coords.x - dragItem.startX);
        const h = Math.abs(coords.y - dragItem.startY);
        setSelectionBox({ x, y, w, h });
        return;
    }

    if (dragItem.type === 'node') {
        if (lastMousePosRef.current) {
            const dx = coords.x - lastMousePosRef.current.x;
            const dy = coords.y - lastMousePosRef.current.y;
            setNodes(prev => prev.map(n => {
                if (selectedNodeIds.has(n.id)) {
                    return { ...n, x: n.x + dx, y: n.y + dy };
                }
                return n;
            }));
            lastMousePosRef.current = { x: coords.x, y: coords.y };
        }
    }

    if (dragItem.type === 'frame') {
         if (lastMousePosRef.current) {
            const dx = coords.x - lastMousePosRef.current.x;
            const dy = coords.y - lastMousePosRef.current.y;
            const frameId = dragItem.id;
            const frame = frames.find(f => f.id === frameId);
            if (frame) {
                const internalNodes = getNodesInFrame(frame, nodes);
                const internalFrames = getFramesInFrame(frame, frames);
                const internalNodeIds = new Set(internalNodes.map(n => n.id));
                const internalFrameIds = new Set(internalFrames.map(f => f.id));
                setFrames(prev => prev.map(f => {
                    if (f.id === frameId || internalFrameIds.has(f.id)) {
                        return { ...f, x: f.x + dx, y: f.y + dy };
                    }
                    return f;
                }));
                setNodes(prev => prev.map(n => internalNodeIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n));
            }
            lastMousePosRef.current = { x: coords.x, y: coords.y };
        }
    }

    if (dragItem.type === 'resize_frame') {
        const dx = coords.x - dragItem.startX;
        const dy = coords.y - dragItem.startY;
        setFrames(prev => prev.map(f => {
            if (f.id !== dragItem.id) return f;
            let newX = dragItem.startFrameX;
            let newY = dragItem.startFrameY;
            let newW = dragItem.startW;
            let newH = dragItem.startH;
            if (dragItem.handle === 'se') {
                newW = Math.max(100, dragItem.startW + dx);
                newH = Math.max(100, dragItem.startH + dy);
            }
            return { ...f, x: newX, y: newY, w: newW, h: newH };
        }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragItem?.type === 'selection_box' && selectionBox) {
        const { x, y, w, h } = selectionBox;
        const newSelected = new Set(selectedNodeIds);
        nodes.forEach(node => {
            const nodeW = node.width || 240;
            const nodeH = node.height || 150; 
            if (node.x < x + w && node.x + nodeW > x && node.y < y + h && node.y + nodeH > y) {
                newSelected.add(node.id);
            }
        });

        // Also Select edges if both source and target are selected
        const newSelectedEdges = new Set<string>();
        edges.forEach(edge => {
            if (newSelected.has(edge.sourceNodeId) && newSelected.has(edge.targetNodeId)) {
                newSelectedEdges.add(edge.id);
            }
        });

        setSelectedNodeIds(newSelected);
        setSelectedEdgeIds(newSelectedEdges);
        setSelectionBox(null);
    }
    
    // Checkpoint on Drag End for Nodes/Frames if they moved
    if (dragItem?.type === 'node' || dragItem?.type === 'frame' || dragItem?.type === 'resize_frame') {
        // Simple check: if dragging occurred, lastMousePosRef won't be null (mostly) and we can assume a change
        // Ideally we check if startX/Y !== current x/y but we updated state directly.
        onCheckpoint();
    }
    
    if (dragItem?.type === 'node') {
        setNodes(prev => prev.map(n => {
            if (selectedNodeIds.has(n.id)) {
                return { ...n, x: snapToGrid(n.x), y: snapToGrid(n.y) };
            }
            return n;
        }));
    }
    if (dragItem?.type === 'frame' || dragItem?.type === 'resize_frame') {
        setFrames(prev => prev.map(f => ({
            ...f,
            x: snapToGrid(f.x),
            y: snapToGrid(f.y),
            w: snapToGrid(f.w),
            h: snapToGrid(f.h)
        })));
    }
    setDragItem(null);
    lastMousePosRef.current = null;
  };

  const getSocketPos = (nodeId: string, socketIdx: number, isInput: boolean) => {
    let node = nodes.find(n => n.id === nodeId);
    if (frameAggregation) {
        if (frameAggregation.hiddenNodeIds.has(nodeId)) {
            return null; 
        }
        if (frameAggregation.frameMap[nodeId]) {
            node = frameAggregation.frameMap[nodeId];
        }
    }
    if (!node) return { x: 0, y: 0 };
    
    // Adjusted Vertical Offset based on new NodeEntity block layout
    // Normal: Header(38) + BodyPad(12) + RateText(16+16=32) = 82px.
    // Collapsed: Header(38) + BodyPad(12) = 50px.
    const baseOffset = collapseFrames ? 50 : 82;
    const yOffset = baseOffset + socketIdx * 36;
    
    const nodeWidth = node.width || 240;
    
    // Adjusted Horizontal Offset
    // Aligned to the border edges where the socket connectors are centered
    return isInput 
        ? { x: node.x, y: node.y + yOffset } 
        : { x: node.x + nodeWidth, y: node.y + yOffset };
  };
  
  const visibleNodes = frameAggregation 
    ? [...nodes.filter(n => !frameAggregation.hiddenNodeIds.has(n.id)), ...Object.values(frameAggregation.frameMap)]
    : nodes;

  const visibleEdges = frameAggregation
    ? edges.map(e => {
        const frameA = frameAggregation.nodeToFrameId.get(e.sourceNodeId);
        const frameB = frameAggregation.nodeToFrameId.get(e.targetNodeId);
        if (frameA && frameB && frameA === frameB) {
            return null;
        }
        let sId = e.sourceNodeId;
        let sIdx = e.sourceSocketIdx;
        let tId = e.targetNodeId;
        let tIdx = e.targetSocketIdx;
        const remapSourceKey = `out-${sId}-${sIdx}`;
        if (frameAggregation.edgeRemap[remapSourceKey]) {
            const mapping = frameAggregation.edgeRemap[remapSourceKey];
            sId = mapping.frameId;
            sIdx = mapping.socketIdx;
        }
        const remapTargetKey = `in-${tId}-${tIdx}`;
        if (frameAggregation.edgeRemap[remapTargetKey]) {
            const mapping = frameAggregation.edgeRemap[remapTargetKey];
            tId = mapping.frameId;
            tIdx = mapping.socketIdx;
        }
        if (frameAggregation.hiddenNodeIds.has(sId) || frameAggregation.hiddenNodeIds.has(tId)) return null;
        return { ...e, sourceNodeId: sId, sourceSocketIdx: sIdx, targetNodeId: tId, targetSocketIdx: tIdx };
    }).filter(e => e !== null) as Connection[]
    : edges;

  return (
    <div 
      className={`w-full h-full bg-[#1c1917] overflow-hidden relative focus:outline-none ${isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
      ref={canvasRef}
      tabIndex={0} 
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        onCheckpoint();
        const prefabData = e.dataTransfer.getData('application/mineflow-prefab');
        const blueprintData = e.dataTransfer.getData('application/mineflow-blueprint');
        const coords = getCanvasCoords(e.clientX, e.clientY);
        if (prefabData) {
             try {
                const prefab = JSON.parse(prefabData);
                handleAddPrefab(prefab, coords);
             } catch(e) {}
        } else if (blueprintData) {
            try {
                const blueprint = JSON.parse(blueprintData);
                handleAddBlueprint(blueprint, coords);
            } catch(e) {}
        }
      }}
    >
        <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
                backgroundImage: 'radial-gradient(#52525b 1px, transparent 1px)', 
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
        />

        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }} className="absolute inset-0 w-full h-full pointer-events-none">
            {!frameAggregation && sortedFrames.map(frame => {
                let inputColor = '#555';
                let outputColor = '#555';

                const internalNodes = getNodesInFrame(frame, nodes);
                if (showEfficiency && internalNodes.length > 0) {
                   const { worstSat, worstOutputRatio } = calculateWorstMetrics(internalNodes, flowState);
                   inputColor = getStatusColor(worstSat);
                   outputColor = getStatusColor(worstOutputRatio);
                }

                // Shadow logic for frames:
                // If selected: 2px gap (#1c1917), 2px white ring, then original inset shadow
                const selectionShadow = selectedFrameId === frame.id ? '0 0 0 2px #1c1917, 0 0 0 4px white, ' : '';
                const insetShadow = 'inset 0 0 20px rgba(0,0,0,0.5)';

                return (
                <div 
                    key={frame.id}
                    className={`absolute border-4 border-dashed font-mono pointer-events-auto group ${selectedFrameId === frame.id ? 'bg-white/5 z-10' : 'bg-zinc-800/10 z-0'}`}
                    style={{
                        left: frame.x,
                        top: frame.y,
                        width: frame.w,
                        height: frame.h,
                        boxShadow: selectionShadow + insetShadow,
                        // Split border effect on frame
                        borderImage: `linear-gradient(90deg, ${inputColor} 50%, ${outputColor} 50%) 1`
                    }}
                    onMouseDown={(e) => handleFrameMouseDown(e, frame.id)}
                >
                    <div 
                        className={`absolute -top-7 left-0 bg-[#222] text-[#eee] px-2 py-1 text-xs font-bold border-2 border-b-0 select-none whitespace-nowrap flex items-center gap-2 cursor-pointer hover:bg-[#333] transition-colors`}
                        style={{ color: 'inherit', borderColor: '#555' }}
                        onDoubleClick={(e) => { e.stopPropagation(); onRenameFrame(frame.id); }}
                        onContextMenu={(e) => handleFrameContextMenu(e, frame.id)}
                    >
                        {frame.label}
                    </div>

                    <div 
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleFrameResizeStart(e, frame, 'se')}
                    >
                        <div className={`w-3 h-3 bg-white/20`} />
                    </div>
                </div>
            )})}

            {selectionBox && (
                <div 
                    className="absolute border border-white/40 bg-white/10 z-10 pointer-events-none"
                    style={{
                        left: selectionBox.x,
                        top: selectionBox.y,
                        width: selectionBox.w,
                        height: selectionBox.h
                    }}
                />
            )}

            <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-10">
                {visibleEdges.map(edge => {
                    const start = getSocketPos(edge.sourceNodeId, edge.sourceSocketIdx, false);
                    const end = getSocketPos(edge.targetNodeId, edge.targetSocketIdx, true);
                    if (!start || !end) return null;
                    const path = getEdgePath(start.x, start.y, end.x, end.y);
                    const flow = flowState.edgeFlows[edge.id];
                    let strokeColor = unitDictionary[edge.type]?.color || '#a1a1aa';
                    if (showEfficiency && flow && flow.capacity > 0 && flow.capacity !== Infinity) {
                        const utilization = flow.utilization;
                        if (flow.status === 'bottleneck') strokeColor = '#FF5555'; // Red (>100%)
                        else if (utilization >= 0.99) strokeColor = '#FFAA00'; // Orange (100%)
                        else strokeColor = '#55FF55'; // Green (<100%)
                    }
                    let strokeWidth = 3;
                    let isSelected = false;
                    if (frameAggregation) {
                    } else {
                        isSelected = selectedEdgeIds.has(edge.id);
                    }
                    
                    const center = getEdgeCenter(start.x, start.y, end.x, end.y);
                    const rateText = flow ? `${parseFloat(flow.rate.toFixed(1))}` : '0';
                    const capText = flow && flow.capacity !== -1 ? ` / ${parseFloat(flow.capacity.toFixed(1))}` : '';
                    const label = `${rateText}${capText}`;

                    return (
                        <g key={`${edge.sourceNodeId}-${edge.targetNodeId}-${edge.sourceSocketIdx}-${edge.targetSocketIdx}`} className="group pointer-events-auto cursor-pointer" 
                           onClick={(e) => { e.stopPropagation(); }}
                           onDoubleClick={(e) => { e.stopPropagation(); onEditEdge(edge); }}
                           onContextMenu={(e) => handleEdgeContextMenu(e, edge.id)}
                        >
                            {/* Selection Outline (White Underlay) */}
                            {isSelected && (
                                <path 
                                    d={path} 
                                    stroke="white" 
                                    strokeWidth={strokeWidth + 6} 
                                    strokeOpacity={1}
                                    fill="none"
                                />
                            )}
                            
                             {/* Selection Gap (Background Color Underlay) */}
                             {isSelected && (
                                <path 
                                    d={path} 
                                    stroke="#1c1917" 
                                    strokeWidth={strokeWidth + 2} 
                                    strokeOpacity={1}
                                    fill="none"
                                />
                            )}
                            
                            {/* Main Colored Line */}
                            <path 
                                d={path} 
                                stroke={strokeColor} 
                                strokeWidth={strokeWidth} 
                                strokeOpacity={isSelected ? 1 : 0.8}
                                fill="none"
                            />

                            {/* Transparent Hit Area */}
                            <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                            
                            {/* Edge Label */}
                            {!collapseFrames && (
                            <foreignObject x={center.x - 40} y={center.y - 10} width={80} height={20} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                                <div className="flex justify-center items-center h-full">
                                    <span className="px-1 py-0.5 bg-[#1c1917]/90 rounded text-[10px] text-zinc-300 font-mono whitespace-nowrap border border-zinc-700 shadow-sm opacity-90 group-hover:opacity-100 group-hover:border-zinc-500 transition-opacity">
                                        {label}
                                    </span>
                                </div>
                            </foreignObject>
                            )}
                        </g>
                    );
                })}

                {(dragItem?.type === 'connection' || pendingConnection) && (
                   (() => {
                        const active = dragItem?.type === 'connection' ? dragItem : pendingConnection!;
                        const startPos = !active.isInput 
                            ? getSocketPos(active.sourceId, active.socketIdx, false)
                            : mousePos;
                        const endPos = active.isInput
                            ? getSocketPos(active.sourceId, active.socketIdx, true)
                            : mousePos;
                        if(!startPos || !endPos) return null;
                        return (
                            <path 
                                d={getEdgePath(startPos.x, startPos.y, endPos.x, endPos.y)} 
                                stroke={pendingConnection ? "#aaa" : "#55FF55"} 
                                strokeWidth="4" 
                                strokeDasharray="10,10" 
                                fill="none" 
                                className="animate-pulse"
                            />
                        )
                   })()
                )}
            </svg>

            <div className="pointer-events-auto z-20 relative">
                {visibleNodes.map(node => {
                    let effectiveFlowData = flowState.nodeRates[node.id] || { efficiency: 1, saturation: 1, outputFlowRatio: 1, actualOpRate: 0, starvedItems: [], backloggedItems: [] };
                    let internalNodesData: InternalNodeStatus[] | undefined = undefined;

                    if (frameAggregation && frameAggregation.frameMap[node.id]) {
                        const frame = frames.find(f => f.id === node.id);
                        if (frame) {
                            const internalNodes = getNodesInFrame(frame, nodes);
                            const { worstSat, worstOutputRatio } = calculateWorstMetrics(internalNodes, flowState);
                            effectiveFlowData = {
                                ...effectiveFlowData,
                                saturation: worstSat,
                                outputFlowRatio: worstOutputRatio,
                                efficiency: Math.min(1, worstSat) 
                            };
                            const agg = frameAggregation.reverseMaps[node.id];
                            if (agg) {
                                internalNodesData = agg.internalNodes.map(n => {
                                    const rate = flowState.nodeRates[n.id];
                                    const hasInputs = n.recipe.inputs.length > 0;
                                    const effectiveInputSat = !hasInputs ? 1.0 : (rate?.saturation ?? 1.0);
                                    const effectiveOutputRatio = n.recipe.outputs.length === 0 ? 1.0 : (rate?.outputFlowRatio ?? 1.0);
                                    
                                    return {
                                        label: n.label,
                                        inputColor: showEfficiency ? getStatusColor(effectiveInputSat) : '#525252',
                                        outputColor: showEfficiency ? getStatusColor(effectiveOutputRatio) : '#525252'
                                    };
                                });
                            }
                        }
                    }

                    return (
                    <NodeEntity
                        key={node.id}
                        node={node}
                        flowData={effectiveFlowData}
                        isSelected={selectedNodeIds.has(node.id) || selectedFrameId === node.id}
                        isFrame={frames.some(f => f.id === node.id)}
                        onMouseDown={(e) => {
                            handleNodeMouseDown(e, node.id);
                        }}
                        onDoubleClick={() => { 
                             if (frames.some(f => f.id === node.id)) {
                                 onRenameFrame(node.id);
                             } else {
                                 setContextMenu(null); 
                                 onEditNode(node); 
                             }
                        }}
                        onEdit={() => {
                            if (frames.some(f => f.id === node.id)) {
                                onRenameFrame(node.id);
                            } else {
                                onEditNode(node);
                            }
                        }}
                        onDuplicate={() => {
                            if (!frames.some(f => f.id === node.id)) onDuplicateNode(node.id);
                        }}
                        onDelete={() => {
                             if (frames.some(f => f.id === node.id)) {
                                onDeleteFrame(node.id);
                             } else {
                                onCheckpoint();
                                setNodes(prev => prev.filter(n => n.id !== node.id));
                                setEdges(prev => prev.filter(e => e.sourceNodeId !== node.id && e.targetNodeId !== node.id));
                             }
                        }}
                        onSocketMouseDown={(e, sIdx, isInput) => handleSocketMouseDown(e, node.id, sIdx, isInput)}
                        onSocketMouseUp={(e, sIdx, isInput) => handleSocketMouseUp(e, node.id, sIdx, isInput)}
                        onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                        unitDictionary={unitDictionary}
                        showEfficiency={showEfficiency}
                        isCollapsed={collapseFrames}
                        internalNodes={internalNodesData}
                    />
                )})}
            </div>
        </div>
        
        {/* ... Rest of context menus ... */}
        {/* Keeping existing JSX structure for context menus and controls */}
        {contextMenu && (
          <ContextMenu 
            x={contextMenu.x} 
            y={contextMenu.y} 
            onClose={() => setContextMenu(null)}
            onSelectPrefab={handleAddPrefab}
            onAddFrame={handleAddFrame}
            prefabs={prefabs}
            onDeleteTemplate={onDeleteCustomPrefab}
            onPaste={handlePaste}
            hasClipboard={!!clipboard}
          />
        )}
        
        {nodeContextMenu && (
            <NodeContextMenu 
                x={nodeContextMenu.x} 
                y={nodeContextMenu.y} 
                onClose={() => setNodeContextMenu(null)}
                onCopy={handleCopy}
                onCut={handleCut}
                onDelete={handleDelete}
                onSaveToLibrary={() => {
                    onSaveToLibrary(nodeContextMenu.nodeId);
                    setNodeContextMenu(null);
                }}
            />
        )}

        {frameContextMenu && (
             <FrameContextMenu 
                x={frameContextMenu.x}
                y={frameContextMenu.y}
                onClose={() => setFrameContextMenu(null)}
                onRename={() => {
                    onRenameFrame(frameContextMenu.frameId);
                    setFrameContextMenu(null);
                }}
                onSaveToLibrary={() => {
                    onSaveFrameToLibrary(frameContextMenu.frameId);
                    setFrameContextMenu(null);
                }}
                onDelete={handleDeleteFrame}
             />
        )}

        {edgeContextMenu && (
            <EdgeContextMenu 
                x={edgeContextMenu.x}
                y={edgeContextMenu.y}
                onClose={() => setEdgeContextMenu(null)}
                onEdit={handleEditEdgeAction}
                onDelete={handleDeleteEdge}
            />
        )}
        
        <SearchPalette 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)}
          nodes={nodes}
          onSelectNode={centerOnNode}
        />

        <div className="absolute bottom-6 left-6 z-50 pointer-events-auto flex flex-col gap-1 bg-zinc-900 border border-zinc-700 p-1 shadow-xl">
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="p-2 hover:bg-zinc-700 text-zinc-300 hover:text-white" title="Zoom In"><ZoomIn size={20}/></button>
            <div className="text-[10px] text-center text-zinc-500 font-mono">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} className="p-2 hover:bg-zinc-700 text-zinc-300 hover:text-white" title="Zoom Out"><ZoomOut size={20}/></button>
            <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-zinc-700 text-zinc-300 hover:text-white" title="Reset View"><Move size={20}/></button>
        </div>

        <div className="absolute bottom-6 right-6 z-50 pointer-events-auto flex flex-col items-end gap-3">
            {showControls ? (
                <div className="bg-zinc-900 border border-zinc-700 p-4 shadow-xl w-64 animate-in fade-in slide-in-from-bottom-5 font-mono">
                    <div className="flex justify-between items-start mb-3 border-b border-zinc-700 pb-2">
                        <div className="flex items-center gap-2">
                             <Info size={16} className="text-[#55FF55]"/>
                             <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Help & Status</h4>
                        </div>
                        <button onClick={() => setShowControls(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={16}/></button>
                    </div>
                    
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Controls</h5>
                    <p className="text-[10px] text-zinc-400 mb-3 leading-relaxed">
                        <span className="text-zinc-300">Middle Mouse</span> to Pan.<br/>
                        <span className="text-zinc-300">Wheel</span> to Zoom.<br/>
                        <span className="text-zinc-300">Right Click</span> Context Menu.<br/>
                        <span className="text-zinc-300">Ctrl+C/V</span> Copy/Paste.<br/>
                        <span className="text-zinc-300">Ctrl+Z/Y</span> Undo/Redo.<br/>
                        <span className="text-zinc-300">Ctrl+D</span> Duplicate.<br/>
                        <span className="text-zinc-300">Ctrl+K</span> Search.<br/>
                        <span className="text-zinc-300">Del</span> Delete Selection.<br/>
                    </p>
                </div>
            ) : (
                <button 
                    onClick={() => setShowControls(true)}
                    className="w-12 h-12 bg-[#333] border-2 border-[#555] hover:border-[#fff] text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    title="Show Controls & Help"
                >
                    <Info size={24} />
                </button>
            )}
        </div>
    </div>
  );
}