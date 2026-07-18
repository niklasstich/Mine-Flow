import { describe, expect, it } from 'vitest';
import { calculateFlows } from './flowEngine';
import { DEFAULT_UNIT_DICTIONARY } from './unitDictionary';
import { Connection, ItemStack, NodeData, Recipe } from '../types';

const item = (name: string, amount: number, overrides: Partial<ItemStack> = {}): ItemStack => ({
  id: name,
  name,
  amount,
  type: 'item',
  unit: 'count',
  ...overrides,
});

const node = (id: string, recipe: Recipe): NodeData => ({
  id,
  x: 0,
  y: 0,
  label: id,
  recipe,
});

const edge = (
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  opts: Partial<Connection> = {}
): Connection => ({
  id,
  sourceNodeId,
  sourceSocketIdx: 0,
  targetNodeId,
  targetSocketIdx: 0,
  type: 'item',
  capacity: -1,
  ...opts,
});

const run = (nodes: NodeData[], edges: Connection[]) =>
  calculateFlows(nodes, edges, DEFAULT_UNIT_DICTIONARY);

describe('calculateFlows', () => {
  it('runs a source node (no inputs) at full rate', () => {
    const source = node('source', {
      inputs: [],
      outputs: [item('ore', 1)],
      processTime: 2,
      processTimeUnit: 'seconds',
    });

    const { nodeRates } = run([source], []);

    expect(nodeRates.source.efficiency).toBe(1);
    expect(nodeRates.source.actualOpRate).toBeCloseTo(0.5, 6);
    expect(nodeRates.source.starvedItems).toEqual([]);
  });

  it('propagates full flow through a matched 1:1 chain', () => {
    const a = node('a', {
      inputs: [],
      outputs: [item('ore', 1)],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const b = node('b', {
      inputs: [item('ore', 1)],
      outputs: [item('ingot', 1)],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const e = edge('a-b', 'a', 'b');

    const { nodeRates, edgeFlows } = run([a, b], [e]);

    expect(nodeRates.b.efficiency).toBeCloseTo(1, 6);
    expect(nodeRates.b.starvedItems).toEqual([]);
    expect(edgeFlows['a-b'].status).toBe('balanced');
    expect(edgeFlows['a-b'].rate).toBeCloseTo(1, 6);
  });

  it('starves a consumer when the source cannot keep up', () => {
    const slowSource = node('slow', {
      inputs: [],
      outputs: [item('ore', 1)],
      processTime: 4, // 0.25 ops/sec
      processTimeUnit: 'seconds',
    });
    const hungry = node('hungry', {
      inputs: [item('ore', 1)],
      outputs: [item('ingot', 1)],
      processTime: 1, // wants 1 ore/sec
      processTimeUnit: 'seconds',
    });
    const e = edge('slow-hungry', 'slow', 'hungry');

    const { nodeRates, edgeFlows } = run([slowSource, hungry], [e]);

    expect(nodeRates.hungry.efficiency).toBeCloseTo(0.25, 6);
    expect(nodeRates.hungry.starvedItems).toContain('ore');
    expect(edgeFlows['slow-hungry'].status).toBe('starved');
  });

  it('caps flow at pipe capacity and reports bottleneck', () => {
    const a = node('a', {
      inputs: [],
      outputs: [item('fluid-in', 10)],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const b = node('b', {
      inputs: [item('fluid-in', 10)],
      outputs: [],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const e = edge('a-b', 'a', 'b', { capacity: 2 });

    const { edgeFlows } = run([a, b], [e]);

    expect(edgeFlows['a-b'].status).toBe('bottleneck');
    expect(edgeFlows['a-b'].rate).toBeCloseTo(2, 6);
  });

  it('splits output proportionally across multiple consumers when undersupplied', () => {
    const source = node('source', {
      inputs: [],
      outputs: [item('ore', 1)], // 1 ore/sec total supply
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    // Two consumers each wanting 1 ore/sec (total demand 2, supply 1 -> 50% each)
    const c1 = node('c1', {
      inputs: [item('ore', 1)],
      outputs: [],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const c2 = node('c2', {
      inputs: [item('ore', 1)],
      outputs: [],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const e1 = edge('source-c1', 'source', 'c1');
    const e2 = edge('source-c2', 'source', 'c2');

    const { edgeFlows, nodeRates } = run([source, c1, c2], [e1, e2]);

    expect(edgeFlows['source-c1'].rate).toBeCloseTo(0.5, 6);
    expect(edgeFlows['source-c2'].rate).toBeCloseTo(0.5, 6);
    expect(nodeRates.c1.efficiency).toBeCloseTo(0.5, 6);
    expect(nodeRates.c2.efficiency).toBeCloseTo(0.5, 6);
  });

  it('reports overflow when a consumer is throttled by a second, scarcer input', () => {
    // "target" needs plentiful ore + scarce catalyst; catalyst starvation caps its
    // actualOpRate, so the ore allocation (sized to max op rate) exceeds what it
    // actually consumes once throttled.
    const plentifulOre = node('plentifulOre', {
      inputs: [],
      outputs: [item('ore', 10)],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const scarceCatalyst = node('scarceCatalyst', {
      inputs: [],
      outputs: [item('catalyst', 1)],
      processTime: 10, // 0.1 ops/sec
      processTimeUnit: 'seconds',
    });
    const target = node('target', {
      inputs: [item('ore', 1), item('catalyst', 1)],
      outputs: [],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const eOre = edge('ore-target', 'plentifulOre', 'target', { targetSocketIdx: 0 });
    const eCatalyst = edge('catalyst-target', 'scarceCatalyst', 'target', { targetSocketIdx: 1 });

    const { edgeFlows } = run([plentifulOre, scarceCatalyst, target], [eOre, eCatalyst]);

    expect(edgeFlows['ore-target'].status).toBe('overflow');
  });

  it('documents the known limitation: a pure feedback loop with no external supply stalls at zero', () => {
    // a produces ore consumed by b; b produces scrap fed back into a as a second input.
    // Every node in this loop starts at actualOpRate 0, and the iterative solver only
    // ever reads *last pass's* rate for a cyclic dependency, so 0 is a stable fixed
    // point it never escapes — see TASKS.md §0 "Loop risk" for the real-solver plan.
    const a = node('a', {
      inputs: [item('scrap', 0.5)],
      outputs: [item('ore', 1)],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const b = node('b', {
      inputs: [item('ore', 1)],
      outputs: [item('scrap', 0.5)],
      processTime: 1,
      processTimeUnit: 'seconds',
    });
    const eAB = edge('a-b', 'a', 'b');
    const eBA = edge('b-a', 'b', 'a', { targetSocketIdx: 0 });

    const { nodeRates } = run([a, b], [eAB, eBA]);

    expect(nodeRates.a.actualOpRate).toBe(0);
    expect(nodeRates.b.actualOpRate).toBe(0);
    expect(nodeRates.a.starvedItems).toContain('scrap');
  });
});