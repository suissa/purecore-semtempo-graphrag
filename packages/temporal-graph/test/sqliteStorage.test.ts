import { SQLiteGraphStorage } from '../src/storage/sqliteStorage'
import { TemporalGraph } from '../src/temporalGraph'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
    await storage.saveNode({ id: 'node-2', data: { label: 'Node 2' } })
    await storage.saveEdge({
      id: 'edge-1',
      from: 'node-1',
      to: 'node-2',
      valid_start: 100,
      event_time: 100,
      observed_at: 100,
      ingested_at: 100,
      relation_kind: 'adjacency',
      evidence_refs: [],
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

    const graph = new TemporalGraph<{ id: string }>(node => node.id, { clock: () => 10 })
    graph.insertNode({ id: 'A' })
    graph.insertNode({ id: 'B' })
    graph.insertNode({ id: 'C' })
    await storage.saveEdge(graph.addTemporalEdge('A', 'B', 1))
    await storage.saveEdge(graph.addTemporalEdge('B', 'C', 2))

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

  it('persists an actual SQLite database across reopen', async () => {
    await storage.close()
    const directory = mkdtempSync(join(tmpdir(), 'purecore-sqlite-'))
    const filename = join(directory, 'graph.sqlite')

    try {
      const first = new SQLiteGraphStorage({ filename })
      await first.init()
      await first.saveNode({ id: 'durable', data: { value: 42 } })
      await first.close()

      const reopened = new SQLiteGraphStorage({ filename })
      await reopened.init()
      expect((await reopened.getNode('durable'))?.data.value).toBe(42)
      await reopened.close()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
