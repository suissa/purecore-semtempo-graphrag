import { SemanticTemporalGraph } from '../src/semanticTemporalGraph'

describe('SemanticTemporalGraph Layer', () => {
  let graph: SemanticTemporalGraph

  beforeEach(() => {
    graph = new SemanticTemporalGraph<{ id: string; text: string }>(d => d.id)
  })

  it('inserts nodes and adds temporal edges over purecore temporal graph engine', async () => {
    const node1 = await graph.insertNode({ id: 'node-1', text: 'Machine Learning' })
    const node2 = await graph.insertNode({ id: 'node-2', text: 'Deep Learning' })

    const edge = await graph.addTemporalEdge(node1.id, node2.id, 1000)

    expect(node1.id).toBe('node-1')
    expect(edge.from).toBe('node-1')
    expect(edge.to).toBe('node-2')
  })

  it('performs fuzzy search over graph nodes', async () => {
    await graph.insertNode({ id: '1', text: 'Artificial Intelligence' })
    await graph.insertNode({ id: '2', text: 'Quantum Computing' })

    const results = await graph.search({ query: 'Artificial', searchType: 'fuzzy' })
    expect(results.length).toBe(1)
    expect(results[0].node.id).toBe('1')
  })

  it('executes AllasCode fluent queries via query()', async () => {
    await graph.insertNode({ id: 'A', text: 'Node A' })
    await graph.insertNode({ id: 'B', text: 'Node B' })
    await graph.addTemporalEdge('A', 'B', 500)

    const result = await graph.query()
      .fromNode('A')
      .traverse({ depth: 1 })
      .execute()

    expect(result.nodes.map(n => n.id)).toEqual(['A', 'B'])
  })
})
