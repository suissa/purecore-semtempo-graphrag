import { TemporalGraph } from '../src/temporalGraph'
import { GraphPruner } from '../src/pruning/graphPruner'
import { calculateExponentialDecay, calculateRelevanceScore } from '../src/pruning/decay'

describe('Graph Pruning & Exponential Decay', () => {
  it('calculates exponential decay accurately', () => {
    const activatedAt = 1000
    const currentTime = 1000 + 86400000
    const decay = calculateExponentialDecay(activatedAt, currentTime, { halfLifeMs: 86400000 })
    expect(decay).toBeCloseTo(0.5, 3)
  })

  it('calculates relevance score with access tracking boost', () => {
    const activatedAt = 1000
    const currentTime = 1000 + 43200000
    const tracker = { accessCount: 10, lastAccessedAt: currentTime }
    const score = calculateRelevanceScore(activatedAt, currentTime, tracker, { halfLifeMs: 86400000, accessWeight: 0.2 })
    expect(score).toBeGreaterThan(0.7)
  })

  it('prunes edges below score threshold and removes isolated nodes', () => {
    const graph = new TemporalGraph<{ id: string }>(d => d.id)
    graph.insertNode({ id: 'A' })
    graph.insertNode({ id: 'B' })
    graph.insertNode({ id: 'C' })

    const now = 1000000
    graph.addTemporalEdge('A', 'B', now - 1000)
    const oldEdge = graph.addTemporalEdge('B', 'C', now - (10 * 86400000))

    const pruner = new GraphPruner(graph)
    const report = pruner.pruneEdges({
      currentTime: now,
      scoreThreshold: 0.1,
      halfLifeMs: 86400000,
      removeIsolatedNodes: true
    })

    expect(report.edgesRemoved).toBe(1)
    expect(graph.getEdge(oldEdge.id)).toBeUndefined()
    expect(graph.getNode('C')).toBeUndefined()
    expect(graph.getNode('A')).toBeDefined()
    expect(graph.getNode('B')).toBeDefined()
  })

  it('compresses transient edges within time window into merged edge', () => {
    const graph = new TemporalGraph<{ id: string }, { count: number }>(d => d.id)
    graph.insertNode({ id: 'A' })
    graph.insertNode({ id: 'B' })

    const t0 = 1000000
    graph.addTemporalEdge('A', 'B', t0, { count: 1 })
    graph.addTemporalEdge('A', 'B', t0 + 5000, { count: 2 })
    graph.addTemporalEdge('A', 'B', t0 + 10000, { count: 3 })

    const pruner = new GraphPruner(graph)
    const compressedCount = pruner.compressTransientEdges({
      timeWindowMs: 15000,
      mergeData: (list) => ({ count: list.reduce((sum, item) => sum + (item?.count ?? 0), 0) })
    })

    expect(compressedCount).toBe(2)
    const remainingEdges = graph.getAllEdges()
    expect(remainingEdges.length).toBe(1)
    expect(remainingEdges[0].data?.count).toBe(6)
  })
})
