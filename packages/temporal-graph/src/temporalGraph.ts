// src/temporalGraph.ts
// Temporal Graph com arestas intervalares + helpers para módulos de métricas

import { NodeAlreadyExistsError, NodeDoesntExistError } from './errors'
import hash from 'object-hash'

export interface TemporalNode<T = any> {
  id: string
  data: T
}

export interface TemporalEdge<T = any> {
  id: string
  from: string
  to: string

  created_at: number // edge was born
  activated_at: number // when interval starts
  deactivated_at?: number // when interval ends (open interval)

  data?: T // optional metadata
}

export class TemporalGraph<NodeData = any, EdgeData = any> {
  private nodes: Map<string, TemporalNode<NodeData>> = new Map()
  private edges: Map<string, TemporalEdge<EdgeData>> = new Map()

  // adjacency maps nodeId → set of edgeIds where `from=nodeId`
  private adjacency: Map<string, Set<string>> = new Map()

  constructor(private identityFn: (data: NodeData) => string) {}

  // ========= NODES =========

  insertNode(data: NodeData): TemporalNode<NodeData> {
    const id = this.identityFn(data)
    const existingNode = this.nodes.get(id)
    if (existingNode) throw new NodeAlreadyExistsError<NodeData>(data, existingNode.data, id)

    const node: TemporalNode<NodeData> = { id, data }
    this.nodes.set(id, node)

    if (!this.adjacency.has(id)) this.adjacency.set(id, new Set())
    return node
  }

  getNode(id: string): TemporalNode<NodeData> | undefined {
    return this.nodes.get(id)
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id)
  }

  getAllNodes(): TemporalNode<NodeData>[] {
    return [...this.nodes.values()]
  }

  // ========= EDGES =========

  private ensureNodeExists(id: string) {
    if (!this.nodes.has(id)) throw new NodeDoesntExistError(id)
  }

  addTemporalEdge(
    from: string | NodeData,
    to: string | NodeData,
    activated_at: number,
    data?: EdgeData,
    deactivated_at?: number
  ): TemporalEdge<EdgeData> {
    const fromId = typeof from === 'string' ? from : this.identityFn(from)
    const toId = typeof to === 'string' ? to : this.identityFn(to)

    this.ensureNodeExists(fromId)
    this.ensureNodeExists(toId)

    const base = { from: fromId, to: toId, activated_at }
    const id = hash(base) // stable identity para esse intervalo

    const edge: TemporalEdge<EdgeData> = {
      id,
      from: fromId,
      to: toId,
      created_at: Date.now(),
      activated_at,
      deactivated_at,
      data
    }

    this.edges.set(id, edge)
    this.adjacency.get(fromId)!.add(id)

    return edge
  }

  deactivateEdge(edgeId: string, timestamp: number) {
    const edge = this.edges.get(edgeId)
    if (!edge) return
    edge.deactivated_at = timestamp
    this.edges.set(edgeId, edge)
  }

  getAllEdges(): TemporalEdge<EdgeData>[] {
    return [...this.edges.values()]
  }

  // ========= TEMPORAL QUERIES BÁSICAS =========

  getActiveEdgesAt(time: number): TemporalEdge<EdgeData>[] {
    return [...this.edges.values()].filter(e => {
      const start = e.activated_at
      const end = e.deactivated_at ?? Infinity
      return start <= time && time <= end
    })
  }

  getEdgesInInterval(start: number, end: number): TemporalEdge<EdgeData>[] {
    return [...this.edges.values()].filter(e => {
      const s = e.activated_at
      const t = e.deactivated_at ?? Infinity
      return t >= start && s <= end
    })
  }

  getOutgoingEdges(nodeId: string): TemporalEdge<EdgeData>[] {
    this.ensureNodeExists(nodeId)
    const set = this.adjacency.get(nodeId)
    if (!set) return []
    const result: TemporalEdge<EdgeData>[] = []
    for (const id of set) {
      const e = this.edges.get(id)
      if (e) result.push(e)
    }
    return result
  }

  // ========= TEMPORAL SHORTEST PATH =========

  // Caminho respeitando ordem temporal (ativação crescente)
  temporalShortestPath(start: string, end: string): string[] | null {
    this.ensureNodeExists(start)
    this.ensureNodeExists(end)

    const visited = new Set<string>()
    const queue: { node: string; time: number; path: string[] }[] = [
      { node: start, time: -Infinity, path: [start] }
    ]

    while (queue.length) {
      const { node, time, path } = queue.shift()!

      if (node === end) return path
      if (visited.has(node)) continue
      visited.add(node)

      const edgeIds = this.adjacency.get(node)
      if (!edgeIds) continue

      for (const id of edgeIds) {
        const e = this.edges.get(id)
        if (!e) continue

        if (e.activated_at >= time) {
          queue.push({
            node: e.to,
            time: e.activated_at,
            path: [...path, e.to]
          })
        }
      }
    }

    return null
  }

  // ========= REMOVAL & PRUNING HELPERS =========

  getEdge(id: string): TemporalEdge<EdgeData> | undefined {
    return this.edges.get(id)
  }

  removeEdge(id: string): boolean {
    const edge = this.edges.get(id)
    if (!edge) return false
    this.edges.delete(id)
    const set = this.adjacency.get(edge.from)
    if (set) set.delete(id)
    return true
  }

  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false
    this.nodes.delete(id)
    this.adjacency.delete(id)

    // Remove all edges connected to this node
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.from === id || edge.to === id) {
        this.edges.delete(edgeId)
      }
    }
    return true
  }
}

