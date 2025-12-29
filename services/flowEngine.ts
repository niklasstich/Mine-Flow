import { NodeData, Connection, FlowState, UnitDictionary } from '../types';
import { getConversionFactor } from './unitDictionary';

export const calculateFlows = (nodes: NodeData[], edges: Connection[], unitDictionary: UnitDictionary): FlowState => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const edgeMap = new Map(edges.map(e => [e.id, e]));
  
  // Initialize State
  const nodeRates: FlowState['nodeRates'] = {};
  const edgeFlows: FlowState['edgeFlows'] = {};

  // Map of inputs/outputs for quick lookup
  const inputConnections: Record<string, Record<number, string[]>> = {};
  const outputConnections: Record<string, Record<number, string[]>> = {};

  nodes.forEach(n => {
    nodeRates[n.id] = { efficiency: 0, actualOpRate: 0, starvedItems: [], backloggedItems: [] };
    inputConnections[n.id] = {};
    outputConnections[n.id] = {};
  });

  edges.forEach(e => {
    if (!inputConnections[e.targetNodeId][e.targetSocketIdx]) {
      inputConnections[e.targetNodeId][e.targetSocketIdx] = [];
    }
    inputConnections[e.targetNodeId][e.targetSocketIdx].push(e.id);

    if (!outputConnections[e.sourceNodeId][e.sourceSocketIdx]) {
      outputConnections[e.sourceNodeId][e.sourceSocketIdx] = [];
    }
    outputConnections[e.sourceNodeId][e.sourceSocketIdx].push(e.id);
  });

  // Iterative approach to solve for feedback loops
  for (let pass = 0; pass < 5; pass++) {
    nodes.forEach(node => {
      const recipe = node.recipe;
      
      let timeInSeconds = recipe.processTime;
      if (recipe.processTimeUnit === 'ticks') {
        timeInSeconds = recipe.processTime / 20;
      }
      
      const maxOpRate = timeInSeconds > 0 ? 1 / timeInSeconds : 0;
      
      let limitingRatio = 1.0;
      const starvedItems: string[] = [];

      // 1. Calculate Limitation based on Inputs
      recipe.inputs.forEach((input, idx) => {
        // Required Rate (Normalized to Base Unit)
        const inputFactor = getConversionFactor(unitDictionary, input.type, input.unit);
        const requiredRatePerOp = input.amount * inputFactor;
        const requiredTotalRate = maxOpRate * requiredRatePerOp;

        const incomingEdges = inputConnections[node.id][idx] || [];
        
        let totalIncomingRate = 0;
        incomingEdges.forEach(edgeId => {
          const edge = edgeMap.get(edgeId);
          if (edge) {
            const sourceNode = nodeMap.get(edge.sourceNodeId);
            const sourceRate = nodeRates[edge.sourceNodeId]?.actualOpRate || 0;
            if (sourceNode) {
              const outputStack = sourceNode.recipe.outputs[edge.sourceSocketIdx];
              const connectedEdges = outputConnections[edge.sourceNodeId][edge.sourceSocketIdx] || [];
              const splitFactor = connectedEdges.length || 1;
              
              if (outputStack) {
                 // Calculate Raw Flow (in Source Units)
                 const rawFlowSourceUnits = (sourceRate * outputStack.amount) / splitFactor;
                 
                 // Normalize Source Flow to Base Unit
                 const sourceFactor = getConversionFactor(unitDictionary, outputStack.type, outputStack.unit);
                 const rawFlowNormalized = rawFlowSourceUnits * sourceFactor;

                 // Apply Pipe Capacity Limit (Assume pipe capacity is unit-agnostic or set in Base Units. 
                 // For complexity, let's assume Capacity is entered in Base Units of the connection type)
                 const capacity = edge.capacity > 0 ? edge.capacity : Infinity;
                 const actualPipeFlow = Math.min(rawFlowNormalized, capacity);
                 
                 totalIncomingRate += actualPipeFlow;
              }
            }
          }
        });
        
        if (requiredTotalRate > 0) {
           const ratio = totalIncomingRate / requiredTotalRate;
           if (ratio < limitingRatio) {
             limitingRatio = ratio;
           }
           if (ratio < 0.99) {
             starvedItems.push(input.name);
           }
        }
      });

      const efficiency = Math.max(0, Math.min(1, limitingRatio));
      const effectiveEfficiency = recipe.inputs.length === 0 ? 1.0 : efficiency;

      nodeRates[node.id] = {
        efficiency: effectiveEfficiency,
        actualOpRate: maxOpRate * effectiveEfficiency,
        starvedItems: recipe.inputs.length === 0 ? [] : starvedItems,
        backloggedItems: [] 
      };
    });
  }

  // Final Pass: Determine Edge Colors
  edges.forEach(edge => {
    const targetNode = nodeMap.get(edge.targetNodeId);
    if (!targetNode) return;
    
    const inputStack = targetNode.recipe.inputs[edge.targetSocketIdx];
    if (!inputStack) return;

    const sourceNode = nodeMap.get(edge.sourceNodeId);
    if (!sourceNode) return;
    const sourceOpRate = nodeRates[sourceNode.id].actualOpRate;
    const outputStack = sourceNode.recipe.outputs[edge.sourceSocketIdx];
    const connectedEdges = outputConnections[edge.sourceNodeId][edge.sourceSocketIdx] || [];
    const splitFactor = connectedEdges.length || 1;
    
    // Normalization Factors
    const sourceFactor = getConversionFactor(unitDictionary, outputStack.type, outputStack.unit);
    const inputFactor = getConversionFactor(unitDictionary, inputStack.type, inputStack.unit);

    // Raw Flow Normalized
    const rawFlowNormalized = ((sourceOpRate * outputStack.amount) / splitFactor) * sourceFactor;
    
    // Apply Capacity (Assumed Base Unit)
    const capacityLimit = edge.capacity > 0 ? edge.capacity : Infinity;
    const actualFlowNormalized = Math.min(rawFlowNormalized, capacityLimit);

    let targetTimeInSeconds = targetNode.recipe.processTime;
    if (targetNode.recipe.processTimeUnit === 'ticks') {
        targetTimeInSeconds = targetNode.recipe.processTime / 20;
    }
    const maxTargetOpRate = targetTimeInSeconds > 0 ? 1 / targetTimeInSeconds : 0;
    const requiredFlowNormalized = maxTargetOpRate * (inputStack.amount * inputFactor);

    let status: FlowState['edgeFlows'][string]['status'] = 'balanced';
    
    const EPSILON = 0.0001;

    // Bottleneck Check
    if (rawFlowNormalized >= requiredFlowNormalized && capacityLimit < requiredFlowNormalized) {
        status = 'bottleneck';
    } else if (actualFlowNormalized < requiredFlowNormalized - EPSILON) {
      status = 'starved'; 
    } else if (actualFlowNormalized > requiredFlowNormalized + EPSILON) {
      status = 'overflow';
    } else {
      status = 'balanced';
    }

    // Convert back to Source Units for display rate, or keep Base? 
    // Let's keep display rate as Source Units so it matches the output node visual.
    const displayRate = actualFlowNormalized / sourceFactor;

    edgeFlows[edge.id] = {
      rate: displayRate,
      status,
      itemName: inputStack.name,
      requiredRate: requiredFlowNormalized, // Note: This is normalized
      capacity: capacityLimit
    };
  });

  return { nodeRates, edgeFlows };
};
