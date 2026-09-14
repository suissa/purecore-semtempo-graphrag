import { TemporalGraph } from '../src/temporalGraph'
import {
  temporalDensity,
  edgeOverlapCount,
  interactionVelocity
} from '../src/metrics/graphMetrics'

describe('graphMetrics', () => {
  let graph: TemporalGraph<string, any>

  beforeEach(() => {
    graph = new TemporalGraph<string, any>((data) => data)
  })

  describe('temporalDensity', () => {
    it('should return 0 for empty graph', () => {
      expect(temporalDensity(graph, 0, 100)).toBe(0)
    })

    it('should return 0 for single node', () => {
      graph.insertNode('A')
      expect(temporalDensity(graph, 0, 100)).toBe(0)
    })

    it('should calculate density correctly', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      // 2 edges in interval
      // Max possible: 3 * 2 = 6 (directed, no self-loop)
      // Density: 2/6 = 1/3 ≈ 0.333
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 15, undefined, 25)

      const density = temporalDensity(graph, 0, 50)
      expect(density).toBeCloseTo(1 / 3, 2)
    })

    it('should return 1 for complete graph', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      // Max possible: 2 * 1 = 2
      // 2 edges = complete
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'A', 15, undefined, 25)

      const density = temporalDensity(graph, 0, 50)
      expect(density).toBe(1)
    })

    it('should only count edges in interval', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 30, undefined, 40) // Outside interval

      // Window: 0-25, only 1 edge
      // Density: 1/6 ≈ 0.167
      const density = temporalDensity(graph, 0, 25)
      expect(density).toBeCloseTo(1 / 6, 2)
    })

    it('should handle larger graphs', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')
      graph.insertNode('D')

      // 3 edges
      // Max possible: 4 * 3 = 12
      // Density: 3/12 = 0.25
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 15, undefined, 25)
      graph.addTemporalEdge('C', 'D', 20, undefined, 30)

      const density = temporalDensity(graph, 0, 50)
      expect(density).toBe(0.25)
    })
    it('should return 0 for empty window or inverted timestamps', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)

      expect(temporalDensity(graph, 20, 20)).toBe(0) // empty window (t0 === t1)
      expect(temporalDensity(graph, 50, 10)).toBe(0) // inverted timestamps (t0 > t1)
    })

    it('should include isolated nodes in max possible edges denominator', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')
      graph.insertNode('ISOLATED')

      // 4 nodes -> maxPossible = 4 * 3 = 12
      // 2 unique active directed pairs: A->B, B->C
      // Density = 2 / 12 = 1/6
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 15, undefined, 25)

      expect(temporalDensity(graph, 0, 50)).toBeCloseTo(2 / 12, 2)
    })

    it('should not exceed 1.0 for multigraph with multiple edges between same pair in default mode', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      // Multiple edges between A and B
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('A', 'B', 25, undefined, 35)
      graph.addTemporalEdge('A', 'B', 40, undefined, 50)

      // Max possible directed pairs: 2 * 1 = 2
      // Unique active directed pair: (A, B) -> 1
      // Density = 1 / 2 = 0.5 (not 3 / 2 = 1.5)
      expect(temporalDensity(graph, 0, 60)).toBe(0.5)
    })

    it('should support continuous spatiotemporal density mode (time)', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      // Window 0 to 100 (100ms)
      // A->B active 0 to 50 (50ms)
      // B->A active 50 to 100 (50ms)
      // Max possible: 2 pairs * 100ms = 200ms
      // Total active time = 50 + 50 = 100ms
      // Density in time mode = 100 / 200 = 0.5
      graph.addTemporalEdge('A', 'B', 0, undefined, 50)
      graph.addTemporalEdge('B', 'A', 50, undefined, 100)

      const timeDensity = temporalDensity(graph, 0, 100, { mode: 'time' })
      expect(timeDensity).toBeCloseTo(0.5, 2)
    })
  })

  describe('edgeOverlapCount and edgeOverlapCountFast (O(n log n))', () => {
    it('should return 0 for empty graph', () => {
      expect(edgeOverlapCount(graph)).toBe(0)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(0)
    })

    it('should return 0 for single edge', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      expect(edgeOverlapCount(graph)).toBe(0)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(0)
    })

    it('should count overlapping edges consistently in both algorithms', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      // Edge 1: 10-20
      // Edge 2: 15-25 (overlaps with 1: 15-20)
      // Edge 3: 30-40 (no overlap)
      // Overlaps: 1 pair (1-2)
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 15, undefined, 25)
      graph.addTemporalEdge('A', 'C', 30, undefined, 40)

      expect(edgeOverlapCount(graph)).toBe(1)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(1)
    })

    it('should count all overlapping pairs in both algorithms', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')
      graph.insertNode('D')

      // All edges overlap: 10-20, 15-25, 12-22
      // Pairs: (1-2), (1-3), (2-3) = 3 overlaps
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 15, undefined, 25)
      graph.addTemporalEdge('C', 'D', 12, undefined, 22)

      expect(edgeOverlapCount(graph)).toBe(3)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(3)
    })

    it('should handle non-overlapping edges', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      // No overlaps (20 < 30, so they don't touch)
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 30, undefined, 40)

      expect(edgeOverlapCount(graph)).toBe(0)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(0)
    })

    it('should handle open intervals in fast algorithm', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      // Edge 1: 10-20
      // Edge 2: 15-∞ (overlaps with 1 and 3)
      // Edge 3: 50-60 (overlaps with 2)
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 15) // No deactivation
      graph.addTemporalEdge('A', 'C', 50, undefined, 60)

      // Pairs: (1, 2) overlap, (2, 3) overlap, (1, 3) do not overlap
      // Total overlaps: 2
      expect(edgeOverlapCount(graph)).toBe(2)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(2)
    })

    it('should handle adjacent edges touching at boundary in fast algorithm', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      // Edge 1: 10-20
      // Edge 2: 20-30 (touches at 20, counts as overlap)
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      graph.addTemporalEdge('B', 'C', 20, undefined, 30)

      expect(edgeOverlapCount(graph)).toBe(1)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(1)
    })

    it('should handle inverted timestamps on edges consistently in fast algorithm', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      // Edge 1: activated 25, deactivated 10 (inverted -> 10..25)
      // Edge 2: activated 20, deactivated 30 (20..30)
      // Overlap: 20..25
      graph.addTemporalEdge('A', 'B', 25, undefined, 10)
      graph.addTemporalEdge('B', 'C', 20, undefined, 30)

      expect(edgeOverlapCount(graph)).toBe(1)
      expect(edgeOverlapCount(graph, { algorithm: 'fast' })).toBe(1)
    })
  })

  describe('interactionVelocity', () => {
    it('should return 0 for invalid interval', () => {
      graph.insertNode('A')
      expect(interactionVelocity(graph, 10, 5)).toBe(0)
      expect(interactionVelocity(graph, 10, 10)).toBe(0)
    })

    it('should calculate velocity per minute', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      // 2 edges in 1 minute (60000ms)
      graph.addTemporalEdge('A', 'B', 0, undefined, 30000)
      graph.addTemporalEdge('B', 'C', 10000, undefined, 40000)

      // Window: 0-60000ms = 1 minute
      // Velocity: 2 edges / 1 minute = 2 edges/min
      const velocity = interactionVelocity(graph, 0, 60000)
      expect(velocity).toBeCloseTo(2, 1)
    })

    it('should handle partial minutes', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      // 1 edge in 30 seconds (30000ms)
      graph.addTemporalEdge('A', 'B', 0, undefined, 15000)

      // Window: 0-30000ms = 0.5 minutes
      // Velocity: 1 edge / 0.5 minute = 2 edges/min
      const velocity = interactionVelocity(graph, 0, 30000)
      expect(velocity).toBeCloseTo(2, 1)
    })

    it('should only count edges in interval', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      graph.addTemporalEdge('A', 'B', 0, undefined, 30000)
      graph.addTemporalEdge('B', 'C', 70000, undefined, 100000) // Outside interval

      // Window: 0-60000ms = 1 minute
      // Only 1 edge in interval
      // Velocity: 1 edge / 1 minute = 1 edge/min
      const velocity = interactionVelocity(graph, 0, 60000)
      expect(velocity).toBeCloseTo(1, 1)
    })

    it('should return 0 when no edges in interval', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      graph.addTemporalEdge('A', 'B', 100000, undefined, 200000)

      // Window: 0-60000ms, no edges
      expect(interactionVelocity(graph, 0, 60000)).toBe(0)
    })
  })
})

