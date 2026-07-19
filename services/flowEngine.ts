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
    nodeRates[n.id] = { efficiency: 0, saturation: 0, outputFlowRatio: 1, actualOpRate: 0, starvedItems: [], backloggedItems: [] };
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

  // Pre-calculate Edge Demands (Target Requirement in Base Units)
  const edgeDemandMap = new Map<string, number>(); // edgeId -> demandRate (base units)
  const socketTotalDemandMap = new Map<string, number>(); // "nodeId-socketIdx" -> totalDemand (base units)

  nodes.forEach(node => {
      // For each output socket, sum demands of connected edges
      node.recipe.outputs.forEach((_, socketIdx) => {
          const connectedEdgeIds = outputConnections[node.id][socketIdx] || [];
          let totalDemand = 0;

          connectedEdgeIds.forEach(edgeId => {
              const edge = edgeMap.get(edgeId);
              if (!edge) return;
              const targetNode = nodeMap.get(edge.targetNodeId);
              if (!targetNode) return;
              
              const input = targetNode.recipe.inputs[edge.targetSocketIdx];
              if (!input) return;

              const timeFactor = getConversionFactor(unitDictionary, 'time', targetNode.recipe.processTimeUnit || 'seconds');
              const time = targetNode.recipe.processTime * timeFactor;
              const maxOpRate = (time > 0 ? 1 / time : 0) * (targetNode.multiplier ?? 1);

              const inputFactor = getConversionFactor(unitDictionary, input.type, input.unit);
              const demandRate = maxOpRate * input.amount * inputFactor;

              edgeDemandMap.set(edgeId, demandRate);
              totalDemand += demandRate;
          });

          socketTotalDemandMap.set(`${node.id}-${socketIdx}`, totalDemand);
      });
  });

  // Iterative approach to solve for feedback loops and input saturation
  for (let pass = 0; pass < 5; pass++) {
    nodes.forEach(node => {
      const recipe = node.recipe;
      
      const timeFactor = getConversionFactor(unitDictionary, 'time', recipe.processTimeUnit || 'seconds');
      const timeInSeconds = recipe.processTime * timeFactor;

      const maxOpRate = (timeInSeconds > 0 ? 1 / timeInSeconds : 0) * (node.multiplier ?? 1);
      
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
              
              if (outputStack) {
                 const sourceFactor = getConversionFactor(unitDictionary, outputStack.type, outputStack.unit);
                 const totalOutputBase = (sourceRate * outputStack.amount) * sourceFactor;

                 const myDemand = edgeDemandMap.get(edgeId) || 0;
                 const totalSocketDemand = socketTotalDemandMap.get(`${sourceNode.id}-${edge.sourceSocketIdx}`) || 0;
                 
                 let allocatedFlowBase = 0;
                 
                 if (totalSocketDemand > 0) {
                     if (totalOutputBase >= totalSocketDemand) {
                         // Sufficient output: satisfy demand
                         allocatedFlowBase = myDemand;
                     } else {
                         // Insufficient output: proportional split
                         allocatedFlowBase = totalOutputBase * (myDemand / totalSocketDemand);
                     }
                 } else {
                     // No demand (e.g. target is off or invalid).
                     allocatedFlowBase = 0;
                 }

                 // Apply Pipe Capacity Limit
                 const capacity = edge.capacity > 0 ? edge.capacity : Infinity;
                 const actualPipeFlow = Math.min(allocatedFlowBase, capacity);
                 
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
      const saturation = recipe.inputs.length === 0 ? 1.0 : limitingRatio; 

      nodeRates[node.id] = {
        efficiency: recipe.inputs.length === 0 ? 1.0 : efficiency,
        saturation: saturation,
        outputFlowRatio: 1.0, // Calculated later
        actualOpRate: maxOpRate * (recipe.inputs.length === 0 ? 1.0 : efficiency),
        starvedItems: recipe.inputs.length === 0 ? [] : starvedItems,
        backloggedItems: [] 
      };
    });
  }

  // Final Pass: Determine Edge Colors and Actual Flow based on Backpressure
  edges.forEach(edge => {
    const targetNode = nodeMap.get(edge.targetNodeId);
    if (!targetNode) return;
    
    const inputStack = targetNode.recipe.inputs[edge.targetSocketIdx];
    if (!inputStack) return;

    const sourceNode = nodeMap.get(edge.sourceNodeId);
    if (!sourceNode) return;
    const sourceOpRate = nodeRates[sourceNode.id].actualOpRate;
    const outputStack = sourceNode.recipe.outputs[edge.sourceSocketIdx];
    
    const sourceFactor = getConversionFactor(unitDictionary, outputStack.type, outputStack.unit);
    const inputFactor = getConversionFactor(unitDictionary, inputStack.type, inputStack.unit);

    // 1. Supply Calculation (using proportional demand logic)
    const totalOutputBase = (sourceOpRate * outputStack.amount) * sourceFactor;
    const myDemand = edgeDemandMap.get(edge.id) || 0;
    const totalSocketDemand = socketTotalDemandMap.get(`${sourceNode.id}-${edge.sourceSocketIdx}`) || 0;
    
    let allocatedSupplyBase = 0;
    if (totalSocketDemand > 0) {
         if (totalOutputBase >= totalSocketDemand) {
             allocatedSupplyBase = myDemand;
         } else {
             allocatedSupplyBase = totalOutputBase * (myDemand / totalSocketDemand);
         }
    }
    
    // 2. Capacity
    const capacityLimit = edge.capacity > 0 ? edge.capacity : Infinity;

    // 3. Backpressure (Actual Consumption)
    // The target consumes based on its actualOpRate.
    const targetOpRate = nodeRates[targetNode.id]?.actualOpRate || 0;
    const targetConsumptionNormalized = targetOpRate * inputStack.amount * inputFactor;

    // Actual Flow
    const actualFlowNormalized = Math.min(allocatedSupplyBase, capacityLimit, targetConsumptionNormalized);

    // Required Rate (Potential Demand)
    const requiredFlowNormalized = myDemand; // Already calculated as Target Max Op Rate * Amount

    let status: FlowState['edgeFlows'][string]['status'] = 'balanced';
    const EPSILON = 0.0001;

    // Determine Status
    if (allocatedSupplyBase > capacityLimit + EPSILON) {
        status = 'bottleneck'; // Pipe is smaller than what is allocated/available
    } else if (allocatedSupplyBase > targetConsumptionNormalized + EPSILON) {
        status = 'overflow'; // Source is providing more than target is eating (Backpressure)
    } else if (actualFlowNormalized < requiredFlowNormalized - EPSILON) {
        // Delivering less than needed
        if (actualFlowNormalized >= allocatedSupplyBase - EPSILON) {
             status = 'starved'; // Supply limited (Source didn't give enough)
        } else {
             status = 'balanced'; // Demand limited (Target isn't asking for more due to internal throttle?) 
        }
    }

    // Convert back to Source Units for display
    const displayRate = actualFlowNormalized / sourceFactor;
    const displayCapacity = capacityLimit === Infinity ? -1 : capacityLimit / sourceFactor;
    const displayRequired = requiredFlowNormalized / sourceFactor;
    
    const utilization = capacityLimit === Infinity ? 0 : actualFlowNormalized / capacityLimit;

    edgeFlows[edge.id] = {
      rate: displayRate,
      utilization,
      status,
      itemName: inputStack.name,
      requiredRate: displayRequired,
      capacity: displayCapacity
    };
  });

  // Post-Calculation: Determine Output Flow Ratios (Efficiency of Outputs)
  nodes.forEach(node => {
      if (node.recipe.outputs.length === 0) return; 

      let totalProduced = 0;
      let totalFlowing = 0;

      node.recipe.outputs.forEach((out, idx) => {
          const outFactor = getConversionFactor(unitDictionary, out.type, out.unit);
          // Produced by machine (in Base Units)
          const produced = nodeRates[node.id].actualOpRate * out.amount * outFactor;
          totalProduced += produced;

          // Flowing out (in Base Units)
          const edgeIds = outputConnections[node.id]?.[idx] || [];
          edgeIds.forEach(eid => {
              const edge = edgeMap.get(eid);
              const flow = edgeFlows[eid];
              if (edge && flow) {
                   totalFlowing += flow.rate * outFactor;
              }
          });
      });

      const ratio = totalProduced > 1e-9 ? totalFlowing / totalProduced : 1.0;
      
      if (nodeRates[node.id]) {
          nodeRates[node.id].outputFlowRatio = Math.min(1.0, Math.max(0, ratio));
      }
  });

  return { nodeRates, edgeFlows };
};