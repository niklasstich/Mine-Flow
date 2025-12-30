import { NodeData, Connection, FrameData, Recipe, ItemStack, ResourceType } from '../types';

export interface FrameAggregation {
  recipe: Recipe;
  // Maps internal "NodeId-SocketIdx" to the new Frame's input/output index
  inputMap: Record<string, number>; // "nodeId-idx" -> frameInputIdx
  outputMap: Record<string, number>; // "nodeId-idx" -> frameOutputIdx
  
  // Reverse Maps for resolving connections
  reverseInputMap: Record<number, { nodeId: string, socketIdx: number }>;
  reverseOutputMap: Record<number, { nodeId: string, socketIdx: number }>;
  
  internalNodeIds: Set<string>;
}

export const getNodesInFrame = (frame: FrameData, nodes: NodeData[]): NodeData[] => {
  return nodes.filter(node => {
    const nodeW = node.width || 220; // Default to standard node width
    const nodeH = node.height || 150; // Approximate height for auto-sized nodes
    
    // Check for full containment
    return (
        node.x >= frame.x && 
        node.x + nodeW <= frame.x + frame.w && 
        node.y >= frame.y && 
        node.y + nodeH <= frame.y + frame.h
    );
  });
};

export const getFramesInFrame = (parentFrame: FrameData, allFrames: FrameData[]): FrameData[] => {
  return allFrames.filter(frame => {
    // Don't include self
    if (frame.id === parentFrame.id) return false;

    // Check for full containment
    return (
        frame.x >= parentFrame.x && 
        frame.x + frame.w <= parentFrame.x + parentFrame.w && 
        frame.y >= parentFrame.y && 
        frame.y + frame.h <= parentFrame.y + parentFrame.h
    );
  });
};

export const calculateFrameAggregation = (
  frame: FrameData, 
  allNodes: NodeData[], 
  allEdges: Connection[]
): FrameAggregation => {
  
  const internalNodes = getNodesInFrame(frame, allNodes);
  const internalNodeIds = new Set(internalNodes.map(n => n.id));
  
  // 1. Build Aggregate Inputs
  const inputs: ItemStack[] = [];
  const inputMap: Record<string, number> = {};
  const reverseInputMap: Record<number, { nodeId: string, socketIdx: number }> = {};

  internalNodes.forEach(node => {
    node.recipe.inputs.forEach((input, idx) => {
      const key = `${node.id}-${idx}`;
      
      const incomingEdges = allEdges.filter(e => e.targetNodeId === node.id && e.targetSocketIdx === idx);
      const hasExternalSource = incomingEdges.some(e => !internalNodeIds.has(e.sourceNodeId));
      const isSatisfiedInternally = incomingEdges.length > 0 && incomingEdges.every(e => internalNodeIds.has(e.sourceNodeId));

      // Expose if it needs external input (not fully satisfied internally) or if explicitly connected externally
      if (isSatisfiedInternally && !hasExternalSource) return;

      const newIdx = inputs.length;
      inputs.push({
        ...input,
        id: `frame-in-${newIdx}`
      });
      inputMap[key] = newIdx;
      reverseInputMap[newIdx] = { nodeId: node.id, socketIdx: idx };
    });
  });

  // 2. Build Aggregate Outputs
  const outputs: ItemStack[] = [];
  const outputMap: Record<string, number> = {};
  const reverseOutputMap: Record<number, { nodeId: string, socketIdx: number }> = {};

  internalNodes.forEach(node => {
    node.recipe.outputs.forEach((output, idx) => {
      const key = `${node.id}-${idx}`;

      const outgoingEdges = allEdges.filter(e => e.sourceNodeId === node.id && e.sourceSocketIdx === idx);
      const hasExternalDest = outgoingEdges.some(e => !internalNodeIds.has(e.targetNodeId));
      const isConsumedInternally = outgoingEdges.length > 0 && outgoingEdges.every(e => internalNodeIds.has(e.targetNodeId));

      if (isConsumedInternally && !hasExternalDest) return;

      const newIdx = outputs.length;
      outputs.push({
        ...output,
        id: `frame-out-${newIdx}`
      });
      outputMap[key] = newIdx;
      reverseOutputMap[newIdx] = { nodeId: node.id, socketIdx: idx };
    });
  });

  const frameRecipe: Recipe = {
    inputs,
    outputs,
    processTime: 1,
    processTimeUnit: 'seconds'
  };

  return {
    recipe: frameRecipe,
    inputMap,
    outputMap,
    reverseInputMap,
    reverseOutputMap,
    internalNodeIds
  };
};