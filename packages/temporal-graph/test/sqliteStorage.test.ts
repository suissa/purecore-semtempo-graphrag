import { SQLiteGraphStorage } from '../src/storage/sqliteStorage'
import { TemporalGraph } from '../src/temporalGraph'

describe('SQLiteGraphStorage Engine', () => {
  let storage: SQLiteGraphStorage

  beforeEach(async () => {
    storage = new SQLiteGraphStorage({ filename: ':memory:' })
    await storage.init()
  })

  afterEach(async () => {
    await storage.close()
  })

  it('initializes and saves nodes & edges', async () => {
    await storage.saveNode({ id: 'node-1', data: { label: 'Node 1' } })
    await storage.saveEdge({
      id: 'edge-1',
      from: 'node-1',
      to: 'node-2',
      created_at: 100,
      activated_at: 100
    })

    const node = await storage.getNode('node-1')
    expect(node?.data.label).toBe('Node 1')

    const edge = await storage.getEdge('edge-1')
    expect(edge?.from).toBe('node-1')
  })

  it('performs recursive BFS traversal query', async () => {
    await storage.saveNode({ id: 'A', data: {} })
    await storage.saveNode({ id: 'B', data: {} })
    await storage.saveNode({ id: 'C', data: {} })

    await storage.saveEdge({ id: 'e1', from: 'A', to: 'B', created_at: 1, activated_at: 1 })
    await storage.saveEdge({ id: 'e2', from: 'B', to: 'C', created_at: 2, activated_at: 2 })

    const result = await storage.bfsTraversal('A', 2)

    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['A', 'B', 'C']))
    expect(result.edges.length).toBe(2)
  })

  it('syncs complete graph from memory', async () => {
    const graph = new TemporalGraph<{ name: string }>(d => d.name)
    graph.insertNode({ name: 'User1' })
    graph.insertNode({ name: 'User2' })
    graph.addTemporalEdge('User1', 'User2', 1000)

    await storage.syncGraph(graph.getAllNodes(), graph.getAllEdges())

    const allNodes = await storage.getAllNodes()
    const allEdges = await storage.getAllEdges()

    expect(allNodes.length).toBe(2)
    expect(allEdges.length).toBe(1)
  })
})
