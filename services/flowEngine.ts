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

  // Iterative approach to solve for feedback loops and input saturation
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

                 // Apply Pipe Capacity Limit (Assume pipe capacity is unit-agnostic or set in Base Units)
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
      // Saturation is the unclamped ratio. If generator (no inputs), saturation is ideal (1.0)
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
    const connectedEdges = outputConnections[edge.sourceNodeId][edge.sourceSocketIdx] || [];
    const splitFactor = connectedEdges.length || 1;
    
    // Normalization Factors
    const sourceFactor = getConversionFactor(unitDictionary, outputStack.type, outputStack.unit);
    const inputFactor = getConversionFactor(unitDictionary, inputStack.type, inputStack.unit);

    // 1. Supply: What the source is pushing
    const rawFlowNormalized = ((sourceOpRate * outputStack.amount) / splitFactor) * sourceFactor;
    
    // 2. Capacity: What the pipe can handle
    const capacityLimit = edge.capacity > 0 ? edge.capacity : Infinity;

    // 3. Demand: What the target actually consumes (Backpressure)
    // We use the target's actualOpRate which accounts for ITS inputs availability.
    // If target is stopped (rate 0), demand is 0.
    const targetOpRate = nodeRates[targetNode.id]?.actualOpRate || 0;
    const targetConsumptionNormalized = targetOpRate * inputStack.amount * inputFactor;

    // Actual Flow is limited by the strict minimum of Supply, Capacity, and Demand
    const actualFlowNormalized = Math.min(rawFlowNormalized, capacityLimit, targetConsumptionNormalized);

    // Max Potential Demand (for Starvation check)
    let targetTimeInSeconds = targetNode.recipe.processTime;
    if (targetNode.recipe.processTimeUnit === 'ticks') {
        targetTimeInSeconds = targetNode.recipe.processTime / 20;
    }
    const maxTargetOpRate = targetTimeInSeconds > 0 ? 1 / targetTimeInSeconds : 0;
    const requiredFlowNormalized = maxTargetOpRate * (inputStack.amount * inputFactor);

    let status: FlowState['edgeFlows'][string]['status'] = 'balanced';
    
    const EPSILON = 0.0001;

    // Determine Status
    if (rawFlowNormalized > capacityLimit + EPSILON) {
        status = 'bottleneck'; // Pipe limited
    } else if (rawFlowNormalized > targetConsumptionNormalized + EPSILON) {
        status = 'overflow'; // Backed up at destination
    } else if (actualFlowNormalized < requiredFlowNormalized - EPSILON) {
        // If we are delivering less than MAX demand, we are effectively starving the machine of full potential
        // But only if supply is the issue. If demand is low (target stopped), it's not 'starved' by this edge.
        
        if (actualFlowNormalized >= rawFlowNormalized - EPSILON) {
             status = 'starved'; // Supply limited
        } else {
             status = 'balanced'; // Demand limited (not starved by this edge)
        }
    } else {
        status = 'balanced';
    }

    // Convert back to Source Units for display
    const displayRate = actualFlowNormalized / sourceFactor;
    const displayCapacity = capacityLimit === Infinity ? -1 : capacityLimit / sourceFactor;
    const displayRequired = requiredFlowNormalized / sourceFactor;
    
    // Calculate Utilization
    const utilization = capacityLimit === Infinity ? 0 : actualFlowNormalized / capacityLimit;

    edgeFlows[edge.id] = {
      rate: displayRate,
      utilization,
      status,
      itemName: inputStack.name,
      requiredRate: displayRequired,
      capacity: displayCapacity // Return capacity in Display Units
    };
  });

  // Post-Calculation: Determine Output Flow Ratios (Efficiency of Outputs)
  nodes.forEach(node => {
      if (node.recipe.outputs.length === 0) return; // Sinks are always efficient output-wise

      let totalProduced = 0;
      let totalFlowing = 0;

      node.recipe.outputs.forEach((out, idx) => {
          const outFactor = getConversionFactor(unitDictionary, out.type, out.unit);
          // Produced by machine (in Base Units)
          const produced = nodeRates[node.id].actualOpRate * out.amount * outFactor;
          totalProduced += produced;

          // Flowing out (in Base Units)
          // Sum of all edges connected to this output
          const edgeIds = outputConnections[node.id]?.[idx] || [];
          edgeIds.forEach(eid => {
              const edge = edgeMap.get(eid);
              const flow = edgeFlows[eid];
              if (edge && flow) {
                   // flow.rate is in Source Units (displayRate), convert to Base
                   totalFlowing += flow.rate * outFactor;
              }
          });
      });

      // Avoid division by zero. If produced is 0, machine is off, so output isn't blocked.
      const ratio = totalProduced > 1e-9 ? totalFlowing / totalProduced : 1.0;
      
      if (nodeRates[node.id]) {
          // Clamp to 0-1. Slight fp errors might make it > 1.
          nodeRates[node.id].outputFlowRatio = Math.min(1.0, Math.max(0, ratio));
      }
  });

  return { nodeRates, edgeFlows };
};