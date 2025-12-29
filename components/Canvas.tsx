import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeEntity } from './NodeEntity';
import { ContextMenu } from './ContextMenu';
import { NodeContextMenu } from './NodeContextMenu';
import { FrameContextMenu } from './FrameContextMenu';
import { getEdgePath, snapToGrid } from '../utils/geometry';
import { calculateFrameAggregation, getNodesInFrame, FrameAggregation } from '../utils/frameUtils';
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
}

export const Canvas: React.FC<CanvasProps> = ({ 
    nodes, setNodes, edges, setEdges, frames, setFrames,
    onEditNode, onEditEdge, onDuplicateNode, onSaveToLibrary, onSaveFrameToLibrary, onRenameFrame, onDeleteFrame,
    prefabs, unitDictionary, isOverlayOpen,
    onDeleteCustomPrefab, collapseFrames
}) => {
  // Selection State
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  
  // Clipboard
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  
  // Interaction State
  const [dragItem, setDragItem] = useState<DragItem>(null);
  const [pendingConnection, setPendingConnection] = useState<{ sourceId: string; socketIdx: number; isInput: boolean } | null>(null);
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [frameContextMenu, setFrameContextMenu] = useState<{ x: number; y: number; frameId: string } | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  // Used to track deltas for group dragging
  const lastMousePosRef = useRef<{x: number, y: number} | null>(null);

  // --- Dynamic Frame Aggregation (Memoized) ---
  const frameAggregation = useMemo(() => {
    // ONLY collapse if explicitly requested by the button
    if (!collapseFrames) return null;

    const frameMap: Record<string, NodeData> = {};
    const hiddenNodeIds = new Set<string>();
    const nodeToFrameId = new Map<string, string>();
    
    // Store mappings as Objects to avoid string parsing issues with GUIDs
    const edgeRemap: Record<string, { frameId: string, socketIdx: number }> = {}; 
    
    const reverseMaps: Record<string, FrameAggregation> = {}; // Store full aggregation per frame for lookup

    frames.forEach(frame => {
        const agg = calculateFrameAggregation(frame, nodes, edges);
        reverseMaps[frame.id] = agg;
        
        // Mark nodes as hidden and map to frame
        agg.internalNodeIds.forEach(id => {
            hiddenNodeIds.add(id);
            nodeToFrameId.set(id, frame.id);
        });
        
        // Create Pseudo-Node for Frame
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

        // Store mappings for edges
        Object.entries(agg.inputMap).forEach(([key, newIdx]) => {
            edgeRemap[`in-${key}`] = { frameId: frame.id, socketIdx: newIdx };
        });
        Object.entries(agg.outputMap).forEach(([key, newIdx]) => {
            edgeRemap[`out-${key}`] = { frameId: frame.id, socketIdx: newIdx };
        });
    });

    return { frameMap, hiddenNodeIds, nodeToFrameId, edgeRemap, reverseMaps };
  }, [nodes, edges, frames, collapseFrames]); // Recalculate when frame data or toggle changes


  const flowState: FlowState = useMemo(() => {
    return calculateFlows(nodes, edges, unitDictionary);
  }, [nodes, edges, unitDictionary]);

  // --- Helpers ---

  // Convert screen coordinates (mouse event) to canvas world coordinates
  const getCanvasCoords = (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
          x: (clientX - rect.left - pan.x) / zoom,
          y: (clientY - rect.top - pan.y) / zoom
      };
  };

  // --- Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const wheelDelta = -e.deltaY;
    const zoomFactor = Math.pow(1.001, wheelDelta);
    
    let newZoom = zoom * zoomFactor;
    newZoom = Math.max(0.1, Math.min(newZoom, 5)); // Clamp 0.1x to 5x

    // Adjust Pan to zoom towards mouse
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Pan Trigger: Middle Mouse (1) OR Left Click (0) + Space
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

    // Left Click on Background
    if (e.button === 0) {
        if (contextMenu) setContextMenu(null);
        if (nodeContextMenu) setNodeContextMenu(null);
        if (frameContextMenu) setFrameContextMenu(null);
        if (pendingConnection) setPendingConnection(null);

        // Start Selection Box
        if (e.target === canvasRef.current) {
            const coords = getCanvasCoords(e.clientX, e.clientY);
            setDragItem({ type: 'selection_box', startX: coords.x, startY: coords.y });
            
            // If shift not held, clear previous
            if (!e.shiftKey) {
                setSelectedNodeIds(new Set());
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

    const coords = getCanvasCoords(e.clientX, e.clientY);
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX: coords.x, canvasY: coords.y });
  };

  const handleNodeContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (contextMenu) setContextMenu(null);
    if (frameContextMenu) setFrameContextMenu(null);
    if (pendingConnection) setPendingConnection(null);

    // Check if this is a collapsed frame pseudo-node
    if (frameAggregation && frameAggregation.frameMap[nodeId]) {
         setFrameContextMenu({ x: e.clientX, y: e.clientY, frameId: nodeId });
         return;
    }

    // If node not selected, select it (exclusive unless shift)
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
    
    setFrameContextMenu({ x: e.clientX, y: e.clientY, frameId });
  };

  const handleAddPrefab = (prefab: Prefab, position?: { x: number, y: number }) => {
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
     // 1. Calculate centroid or top-left of blueprint nodes
     if (blueprint.nodes.length === 0) return;
     
     const minX = Math.min(...blueprint.nodes.map(n => n.x));
     const minY = Math.min(...blueprint.nodes.map(n => n.y));
     
     const offsetX = position.x - minX;
     const offsetY = position.y - minY;
     
     const idMap = new Map<string, string>(); // OldId -> NewId
     
     // 2. Clone Nodes with new IDs
     const newNodes: NodeData[] = blueprint.nodes.map(n => {
         const newId = crypto.randomUUID();
         idMap.set(n.id, newId);
         
         // Clone recipe with new Socket IDs
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
     
     // 3. Clone Edges
     const newEdges: Connection[] = blueprint.edges.map(e => ({
         ...e,
         id: crypto.randomUUID(),
         sourceNodeId: idMap.get(e.sourceNodeId)!,
         targetNodeId: idMap.get(e.targetNodeId)!
     }));
     
     // 4. Clone Frames (if any)
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
      const newFrame: FrameData = {
          id: crypto.randomUUID(),
          label: "New Frame",
          x: snapToGrid(contextMenu.canvasX),
          y: snapToGrid(contextMenu.canvasY),
          w: 600,
          h: 400,
          color: '#93c5fd' // Blue-300
      };
      setFrames(prev => [...prev, newFrame]);
      setSelectedFrameId(newFrame.id);
      setContextMenu(null);
  };

  // --- Clipboard / Node Menu Actions ---

  const handleCopy = () => {
      if(!nodeContextMenu) return;
      
      let nodesToCopy: NodeData[] = [];
      
      // If we right clicked a node that is part of selection, copy all selection
      // If we right clicked a node NOT part of selection, copy just that node (but logic in handleNodeContextMenu already selects it)
      nodesToCopy = nodes.filter(n => selectedNodeIds.has(n.id));
      
      const ids = new Set(nodesToCopy.map(n => n.id));
      const edgesToCopy = edges.filter(e => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId));
      
      setClipboard({ nodes: nodesToCopy, edges: edgesToCopy });
      setNodeContextMenu(null);
  };

  const handleCut = () => {
      if(!nodeContextMenu) return;
      handleCopy();
      
      // Delete selected
      const idsToDelete = new Set([...selectedNodeIds]);
      setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
      setEdges(prev => prev.filter(e => !idsToDelete.has(e.sourceNodeId) && !idsToDelete.has(e.targetNodeId)));
      setSelectedNodeIds(new Set());
      setNodeContextMenu(null);
  };

  const handleDelete = () => {
      if(!nodeContextMenu) return;
      const idsToDelete = new Set([...selectedNodeIds]);
      setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
      setEdges(prev => prev.filter(e => !idsToDelete.has(e.sourceNodeId) && !idsToDelete.has(e.targetNodeId)));
      setSelectedNodeIds(new Set());
      setNodeContextMenu(null);
  }
  
  const handleDeleteFrame = () => {
      if (!frameContextMenu) return;
      onDeleteFrame(frameContextMenu.frameId);
      setFrameContextMenu(null);
  }

  const handlePaste = () => {
      if(!clipboard || !contextMenu) return;
      
      const { nodes: clipNodes, edges: clipEdges } = clipboard;
      if(clipNodes.length === 0) return;
      
      // Calculate center of clipboard nodes
      const minX = Math.min(...clipNodes.map(n => n.x));
      const minY = Math.min(...clipNodes.map(n => n.y));
      
      // Target position
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

  // --- Frame Handlers ---
  
  const handleFrameMouseDown = (e: React.MouseEvent, frameId: string) => {
      // Allow node selection behavior when collapsed
      if (frameAggregation && frameAggregation.frameMap[frameId]) return;

      e.stopPropagation();
      if (e.button !== 0) return;
      
      const coords = getCanvasCoords(e.clientX, e.clientY);
      lastMousePosRef.current = { x: coords.x, y: coords.y };
      
      setSelectedFrameId(frameId);
      setSelectedNodeIds(new Set()); // Clear node selection
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
    if (pendingConnection) return; 

    if (e.button === 0) {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      lastMousePosRef.current = { x: coords.x, y: coords.y };

      // Check if this is a collapsed frame interaction
      if (frameAggregation && frameAggregation.frameMap[id]) {
          setSelectedFrameId(id);
          setSelectedNodeIds(new Set()); // Clear node selection
          setDragItem({ type: 'frame', id, startX: coords.x, startY: coords.y });
          return;
      }

      // Multi-Select Logic
      if (e.ctrlKey || e.shiftKey) {
          const newSet = new Set(selectedNodeIds);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setSelectedNodeIds(newSet);
          setDragItem({ type: 'node', id, startX: coords.x, startY: coords.y });
      } else {
          if (!selectedNodeIds.has(id)) {
            setSelectedNodeIds(new Set([id]));
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

    // --- Frame Connection Resolution ---
    if (frameAggregation) {
        // Resolve Output Source if it is a Frame
        if (frameAggregation.frameMap[outputId]) {
            const agg = frameAggregation.reverseMaps[outputId];
            if (agg && agg.reverseOutputMap[outputIdx]) {
                const real = agg.reverseOutputMap[outputIdx];
                outputId = real.nodeId;
                outputIdx = real.socketIdx;
            } else {
                console.warn("Could not resolve frame output");
                setPendingConnection(null);
                return;
            }
        }

        // Resolve Input Target if it is a Frame
        if (frameAggregation.frameMap[inputId]) {
            const agg = frameAggregation.reverseMaps[inputId];
            if (agg && agg.reverseInputMap[inputIdx]) {
                 const real = agg.reverseInputMap[inputIdx];
                 inputId = real.nodeId;
                 inputIdx = real.socketIdx;
            } else {
                console.warn("Could not resolve frame input");
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
            
            // Move Frame
            const frameId = dragItem.id;
            const frame = frames.find(f => f.id === frameId);
            
            if (frame) {
                // Move nodes inside frame
                const internalNodes = getNodesInFrame(frame, nodes);
                const internalIds = new Set(internalNodes.map(n => n.id));

                setFrames(prev => prev.map(f => f.id === frameId ? { ...f, x: f.x + dx, y: f.y + dy } : f));
                setNodes(prev => prev.map(n => internalIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n));
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
        
        setSelectedNodeIds(newSelected);
        setSelectionBox(null);
    }

    // Snap nodes to grid
    if (dragItem?.type === 'node') {
        setNodes(prev => prev.map(n => {
            if (selectedNodeIds.has(n.id)) {
                return { ...n, x: snapToGrid(n.x), y: snapToGrid(n.y) };
            }
            return n;
        }));
    }
    
    // Snap frames to grid
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
    // If collapsed, we might need to look at frame map
    let node = nodes.find(n => n.id === nodeId);
    
    // Check if this is a pseudo-node (frame)
    if (frameAggregation) {
        if (frameAggregation.hiddenNodeIds.has(nodeId)) {
            // Internal node is hidden. 
            // We should NOT be calculating position for it directly unless we're drawing internal edges?
            // But visibleEdges filters internal edges out.
            return null; 
        }
        if (frameAggregation.frameMap[nodeId]) {
            node = frameAggregation.frameMap[nodeId];
        }
    }

    if (!node) return { x: 0, y: 0 };
    const yOffset = 95 + socketIdx * 36;
    const nodeWidth = node.width || 240;
    
    return isInput ? { x: node.x, y: node.y + yOffset } : { x: node.x + nodeWidth, y: node.y + yOffset };
  };

  // --- Render Prep ---
  
  const visibleNodes = frameAggregation 
    ? [...nodes.filter(n => !frameAggregation.hiddenNodeIds.has(n.id)), ...Object.values(frameAggregation.frameMap)]
    : nodes;

  const visibleEdges = frameAggregation
    ? edges.map(e => {
        // If edge is internal to THE SAME hidden frame, hide it. 
        // Cross-frame edges (hidden -> hidden) should be visible (as frame -> frame).
        
        const frameA = frameAggregation.nodeToFrameId.get(e.sourceNodeId);
        const frameB = frameAggregation.nodeToFrameId.get(e.targetNodeId);
        
        if (frameA && frameB && frameA === frameB) {
            return null;
        }

        let sId = e.sourceNodeId;
        let sIdx = e.sourceSocketIdx;
        let tId = e.targetNodeId;
        let tIdx = e.targetSocketIdx;

        // Remap Source
        const remapSourceKey = `out-${sId}-${sIdx}`;
        if (frameAggregation.edgeRemap[remapSourceKey]) {
            const mapping = frameAggregation.edgeRemap[remapSourceKey];
            sId = mapping.frameId;
            sIdx = mapping.socketIdx;
        }

        // Remap Target
        const remapTargetKey = `in-${tId}-${tIdx}`;
        if (frameAggregation.edgeRemap[remapTargetKey]) {
            const mapping = frameAggregation.edgeRemap[remapTargetKey];
            tId = mapping.frameId;
            tIdx = mapping.socketIdx;
        }
        
        // If remapping failed but node is hidden, skip it.
        // This handles fully internal edges that somehow passed the first check, or malformed/missing exposures.
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
                backgroundImage: 'radial-gradient(#52525b 1px, transparent 1px)', // zinc-600
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
        />

        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }} className="absolute inset-0 w-full h-full pointer-events-none">
            
            {/* Frames (Visual Boxes - Only when NOT Aggregated) */}
            {!frameAggregation && frames.map(frame => (
                <div 
                    key={frame.id}
                    className={`absolute border-2 rounded pointer-events-auto group ${selectedFrameId === frame.id ? 'border-white bg-white/5' : 'border-zinc-600 bg-zinc-800/30'}`}
                    style={{
                        left: frame.x,
                        top: frame.y,
                        width: frame.w,
                        height: frame.h,
                        borderColor: frame.color
                    }}
                    onMouseDown={(e) => handleFrameMouseDown(e, frame.id)}
                    // Removed onContextMenu here to allow default canvas context menu (Add Machine) in detailed mode
                >
                    {/* Label */}
                    <div 
                        className="absolute -top-7 left-0 bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs font-bold border border-zinc-700 select-none whitespace-nowrap flex items-center gap-2 cursor-pointer hover:bg-zinc-700 hover:text-white transition-colors"
                        style={{ borderColor: frame.color, color: frame.color }}
                        onDoubleClick={(e) => { e.stopPropagation(); onRenameFrame(frame.id); }}
                        onContextMenu={(e) => handleFrameContextMenu(e, frame.id)}
                    >
                        {frame.label}
                    </div>

                    {/* Resize Handle (Bottom Right) */}
                    <div 
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleFrameResizeStart(e, frame, 'se')}
                    >
                        <div className="w-2 h-2 border-r-2 border-b-2" style={{ borderColor: frame.color }} />
                    </div>
                </div>
            ))}

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
                    const strokeColor = unitDictionary[edge.type]?.color || '#a1a1aa';
                    let strokeWidth = 2;

                    let isSelected = false;
                    if (frameAggregation) {
                       // Skip selection visual for remapped edges
                    } else {
                        isSelected = selectedNodeIds.has(edge.sourceNodeId) && selectedNodeIds.has(edge.targetNodeId);
                    }

                    let statusColor = null;
                    if (flow) {
                        if (flow.status === 'starved') statusColor = '#f97316'; 
                        else if (flow.status === 'overflow') statusColor = '#eab308'; 
                        else if (flow.status === 'bottleneck') statusColor = '#ef4444'; 
                        if (flow.rate > 0) strokeWidth = 4;
                    }

                    return (
                        <g key={`${edge.sourceNodeId}-${edge.targetNodeId}-${edge.sourceSocketIdx}-${edge.targetSocketIdx}`} className="group pointer-events-auto cursor-pointer" 
                           onClick={(e) => { e.stopPropagation(); }}
                           onDoubleClick={(e) => { e.stopPropagation(); onEditEdge(edge); }}
                        >
                            <path 
                                d={path} 
                                stroke={isSelected ? '#fff' : strokeColor} 
                                strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth} 
                                strokeOpacity={isSelected ? 0.9 : 0.6}
                                fill="none"
                            />
                            {statusColor && (
                                <path 
                                    d={path} 
                                    stroke={statusColor} 
                                    strokeWidth={2} 
                                    fill="none"
                                    strokeDasharray="4,4"
                                    className="animate-pulse"
                                />
                            )}
                            <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                        </g>
                    );
                })}

                {/* Drag / Pending Line */}
                {(dragItem?.type === 'connection' || pendingConnection) && (
                   (() => {
                        const active = dragItem?.type === 'connection' ? dragItem : pendingConnection!;
                        if (frameAggregation && !pendingConnection) {
                             // Allow dragging lines from frame sockets
                        }

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
                                stroke={pendingConnection ? "#d4d4d8" : "#60a5fa"} // zinc-300
                                strokeWidth="3" 
                                strokeDasharray="5,5" 
                                fill="none" 
                                className="animate-pulse"
                            />
                        )
                   })()
                )}
            </svg>

            <div className="pointer-events-auto z-20 relative">
                {visibleNodes.map(node => (
                    <NodeEntity
                        key={node.id}
                        node={node}
                        flowData={flowState.nodeRates[node.id] || { efficiency: 1, actualOpRate: 0, starvedItems: [], backloggedItems: [] }}
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
                                setNodes(prev => prev.filter(n => n.id !== node.id));
                                setEdges(prev => prev.filter(e => e.sourceNodeId !== node.id && e.targetNodeId !== node.id));
                             }
                        }}
                        onSocketMouseDown={(e, sIdx, isInput) => handleSocketMouseDown(e, node.id, sIdx, isInput)}
                        onSocketMouseUp={(e, sIdx, isInput) => handleSocketMouseUp(e, node.id, sIdx, isInput)}
                        onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                        unitDictionary={unitDictionary}
                    />
                ))}
            </div>
        </div>

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
        
        {/* Zoom Controls - Bottom Left */}
        <div className="absolute bottom-6 left-6 z-50 pointer-events-auto flex flex-col gap-1 bg-zinc-800/90 border border-zinc-700 rounded p-1 shadow-xl backdrop-blur">
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="p-2 hover:bg-zinc-700 rounded text-zinc-300 hover:text-white" title="Zoom In"><ZoomIn size={20}/></button>
            <div className="text-[10px] text-center text-zinc-500">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} className="p-2 hover:bg-zinc-700 rounded text-zinc-300 hover:text-white" title="Zoom Out"><ZoomOut size={20}/></button>
            <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-zinc-700 rounded text-zinc-300 hover:text-white" title="Reset View"><Move size={20}/></button>
        </div>

        {/* Help / Status Controls - Bottom Right */}
        <div className="absolute bottom-6 right-6 z-50 pointer-events-auto flex flex-col items-end gap-3">
            {showControls ? (
                <div className="bg-zinc-800/90 border border-zinc-700 p-4 rounded shadow-xl backdrop-blur w-64 animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-start mb-3 border-b border-zinc-700 pb-2">
                        <div className="flex items-center gap-2">
                             <Info size={16} className="text-emerald-400"/>
                             <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Help & Status</h4>
                        </div>
                        <button onClick={() => setShowControls(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={16}/></button>
                    </div>
                    
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Controls</h5>
                    <p className="text-[10px] text-zinc-400 mb-3 leading-relaxed">
                        <span className="text-zinc-300">Space + Drag</span> to Pan.<br/>
                        <span className="text-zinc-300">Wheel</span> to Zoom.<br/>
                        <span className="text-zinc-300">Right Click</span> Context Menu.<br/>
                        <span className="text-zinc-300">Drag Bkg</span> to Select Area.<br/>
                    </p>
                </div>
            ) : (
                <button 
                    onClick={() => setShowControls(true)}
                    className="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    title="Show Controls & Help"
                >
                    <Info size={24} />
                </button>
            )}
        </div>
    </div>
  );
};