import { TemporalGraph, TemporalEdge } from '../src/temporalGraph'
import {
  edgeDuration,
  averageEdgeDurationBetween,
  edgeRecurrence
} from '../src/metrics/edgeMetrics'

describe('edgeMetrics', () => {
  let graph: TemporalGraph<string, any>

  beforeEach(() => {
    graph = new TemporalGraph<string, any>((data) => data)
  })

  describe('edgeDuration', () => {
    it('should calculate duration for closed edge', () => {
      const edge: TemporalEdge = {
        id: 'test',
        from: 'A',
        to: 'B',
        created_at: 0,
        activated_at: 10,
        deactivated_at: 30
      }

      expect(edgeDuration(edge)).toBe(20)
    })

    it('should use now for open edge', () => {
      const now = 100
      const edge: TemporalEdge = {
        id: 'test',
        from: 'A',
        to: 'B',
        created_at: 0,
        activated_at: 10
        // No deactivation
      }

      expect(edgeDuration(edge, now)).toBe(90) // 100 - 10
    })

    it('should default to Date.now() when now not provided', () => {
      const edge: TemporalEdge = {
        id: 'test',
        from: 'A',
        to: 'B',
        created_at: 0,
        activated_at: Date.now() - 1000 // 1 second ago
        // No deactivation
      }

      const duration = edgeDuration(edge)
      // Should be approximately 1000ms (within 100ms tolerance)
      expect(duration).toBeGreaterThan(900)
      expect(duration).toBeLessThan(1100)
    })

    it('should handle zero duration', () => {
      const edge: TemporalEdge = {
        id: 'test',
        from: 'A',
        to: 'B',
        created_at: 0,
        activated_at: 10,
        deactivated_at: 10
      }

      expect(edgeDuration(edge)).toBe(0)
    })
  })

  describe('averageEdgeDurationBetween', () => {
    it('should return 0 when no edges exist', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      expect(averageEdgeDurationBetween(graph, 'A', 'B')).toBe(0)
    })

    it('should calculate average duration correctly', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      const now = 100

      // Edge 1: 10ms duration (10-20)
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      // Edge 2: 20ms duration (30-50)
      graph.addTemporalEdge('A', 'B', 30, undefined, 50)

      // Average: (10 + 20) / 2 = 15ms
      expect(averageEdgeDurationBetween(graph, 'A', 'B', now)).toBe(15)
    })

    it('should only consider edges between specified nodes', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      const now = 100

      graph.addTemporalEdge('A', 'B', 10, undefined, 20) // 10ms
      graph.addTemporalEdge('A', 'C', 30, undefined, 50) // 20ms (should be ignored)
      graph.addTemporalEdge('A', 'B', 60, undefined, 80) // 20ms

      // Average: (10 + 20) / 2 = 15ms (only A->B edges)
      expect(averageEdgeDurationBetween(graph, 'A', 'B', now)).toBe(15)
    })

    it('should handle open intervals', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      const now = 100

      // Edge 1: closed (10-20 = 10ms)
      graph.addTemporalEdge('A', 'B', 10, undefined, 20)
      // Edge 2: open (30-now = 70ms)
      const edge2 = graph.addTemporalEdge('A', 'B', 30) // No deactivation

      // Average: (10 + 70) / 2 = 40ms
      expect(averageEdgeDurationBetween(graph, 'A', 'B', now)).toBe(40)
    })

    it('should handle single edge', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      const now = 100

      graph.addTemporalEdge('A', 'B', 10, undefined, 30)

      // Average: 20ms / 1 = 20ms
      expect(averageEdgeDurationBetween(graph, 'A', 'B', now)).toBe(20)
    })

    it('should not consider reverse direction', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      const now = 100

      graph.addTemporalEdge('A', 'B', 10, undefined, 20) // Should be counted
      graph.addTemporalEdge('B', 'A', 30, undefined, 50) // Should be ignored

      // Average: 10ms / 1 = 10ms (only A->B)
      expect(averageEdgeDurationBetween(graph, 'A', 'B', now)).toBe(10)
    })
  })

  describe('edgeRecurrence', () => {
    it('should return 0 when no edges exist', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      expect(edgeRecurrence(graph, 'A', 'B')).toBe(0)
    })

    it('should count edges between nodes', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      graph.addTemporalEdge('A', 'B', 10, 20)
      graph.addTemporalEdge('A', 'B', 30, 40)
      graph.addTemporalEdge('A', 'B', 50, 60)

      expect(edgeRecurrence(graph, 'A', 'B')).toBe(3)
    })

    it('should only count edges in specified direction', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      graph.addTemporalEdge('A', 'B', 10, 20) // Counted
      graph.addTemporalEdge('A', 'B', 30, 40) // Counted
      graph.addTemporalEdge('B', 'A', 50, 60) // Not counted

      expect(edgeRecurrence(graph, 'A', 'B')).toBe(2)
    })

    it('should handle single recurrence', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      graph.addTemporalEdge('A', 'B', 10, 20)

      expect(edgeRecurrence(graph, 'A', 'B')).toBe(1)
    })

    it('should ignore edges to other nodes', () => {
      graph.insertNode('A')
      graph.insertNode('B')
      graph.insertNode('C')

      graph.addTemporalEdge('A', 'B', 10, 20) // Counted
      graph.addTemporalEdge('A', 'C', 30, 40) // Ignored
      graph.addTemporalEdge('B', 'C', 50, 60) // Ignored

      expect(edgeRecurrence(graph, 'A', 'B')).toBe(1)
    })

    it('should count edges regardless of time', () => {
      graph.insertNode('A')
      graph.insertNode('B')

      // Edges at different times
      graph.addTemporalEdge('A', 'B', 10, 20)
      graph.addTemporalEdge('A', 'B', 1000, 2000)
      graph.addTemporalEdge('A', 'B', 50000, 60000)

      expect(edgeRecurrence(graph, 'A', 'B')).toBe(3)
    })

    it('should handle nodes that do not exist', () => {
      graph.insertNode('A')

      // Should not throw, just return 0
      expect(edgeRecurrence(graph, 'A', 'B')).toBe(0)
      expect(edgeRecurrence(graph, 'X', 'Y')).toBe(0)
    })
  })
})

