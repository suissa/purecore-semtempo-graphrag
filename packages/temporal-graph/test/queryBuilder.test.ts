import { TemporalGraph } from '../src/temporalGraph'
import { GraphQueryBuilder } from '../src/dsl/queryBuilder'

describe('AllasCode Style Graph Query Builder DSL (Pure Engine)', () => {
  let graph: TemporalGraph<{ id: string; category?: string }>

  beforeEach(() => {
    graph = new TemporalGraph<{ id: string; category?: string }>(d => d.id)
    graph.insertNode({ id: 'user-1', category: 'eng' })
    graph.insertNode({ id: 'user-2', category: 'mgmt' })
    graph.insertNode({ id: 'user-3', category: 'design' })

    graph.addTemporalEdge('user-1', 'user-2', 1000)
    graph.addTemporalEdge('user-2', 'user-3', 2000)
  })

  it('queries within time range and filters nodes with fluent API', async () => {
    const builder = new GraphQueryBuilder(graph)
    const result = await builder
      .withinTimeRange(500, 1500)
      .filterNode(n => n.data.category === 'eng')
      .execute()

    expect(result.nodes.length).toBe(1)
    expect(result.nodes[0].id).toBe('user-1')
  })

  it('traverses from node up to depth=2 with outgoing direction', async () => {
    const builder = new GraphQueryBuilder(graph)
    const result = await builder
      .fromNode('user-1')
      .traverse({ depth: 2, direction: 'outgoing' })
      .execute()

    expect(result.nodes.map(n => n.id)).toEqual(['user-1', 'user-2', 'user-3'])
    expect(result.paths).toContainEqual(['user-1', 'user-2', 'user-3'])
  })
})
