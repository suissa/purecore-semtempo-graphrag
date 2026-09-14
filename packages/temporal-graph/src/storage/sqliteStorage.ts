import { TemporalNode, TemporalEdge } from '../temporalGraph'
import { IGraphStorageAdapter, SQLiteStorageConfig, StorageTraversalResult } from './types'

export class SQLiteGraphStorage<NodeData = any, EdgeData = any>
  implements IGraphStorageAdapter<NodeData, EdgeData> {
  private dbFilename: string
  private nodesTable = new Map<string, TemporalNode<NodeData>>()
  private edgesTable = new Map<string, TemporalEdge<EdgeData>>()
  private isInitialized = false

  constructor(config: SQLiteStorageConfig = {}) {
    this.dbFilename = config.filename ?? ':memory:'
  }

  async init(): Promise<void> {
    this.isInitialized = true
  }

  async saveNode(node: TemporalNode<NodeData>): Promise<void> {
    this.nodesTable.set(node.id, JSON.parse(JSON.stringify(node)))
  }

  async saveEdge(edge: TemporalEdge<EdgeData>): Promise<void> {
    this.edgesTable.set(edge.id, JSON.parse(JSON.stringify(edge)))
  }

  async getNode(id: string): Promise<TemporalNode<NodeData> | undefined> {
    const node = this.nodesTable.get(id)
    return node ? JSON.parse(JSON.stringify(node)) : undefined
  }

  async getEdge(id: string): Promise<TemporalEdge<EdgeData> | undefined> {
    const edge = this.edgesTable.get(id)
    return edge ? JSON.parse(JSON.stringify(edge)) : undefined
  }

  async getAllNodes(): Promise<TemporalNode<NodeData>[]> {
    return Array.from(this.nodesTable.values()).map(n => JSON.parse(JSON.stringify(n)))
  }

  async getAllEdges(): Promise<TemporalEdge<EdgeData>[]> {
    return Array.from(this.edgesTable.values()).map(e => JSON.parse(JSON.stringify(e)))
  }

  async deleteNode(id: string): Promise<void> {
    this.nodesTable.delete(id)
    for (const [edgeId, edge] of this.edgesTable.entries()) {
      if (edge.from === id || edge.to === id) {
        this.edgesTable.delete(edgeId)
      }
    }
  }

  async deleteEdge(id: string): Promise<void> {
    this.edgesTable.delete(id)
  }

  async getEdgesInInterval(start: number, end: number): Promise<TemporalEdge<EdgeData>[]> {
    const result: TemporalEdge<EdgeData>[] = []
    for (const edge of this.edgesTable.values()) {
      const s = edge.activated_at
      const t = edge.deactivated_at ?? Infinity
      if (t >= start && s <= end) {
        result.push(JSON.parse(JSON.stringify(edge)))
      }
    }
    return result
  }

  async bfsTraversal(startNodeId: string, maxDepth: number = 2): Promise<StorageTraversalResult<NodeData, EdgeData>> {
    const visitedNodes = new Set<string>()
    const traversedNodeIds = new Set<string>()
    const traversedEdges = new Map<string, TemporalEdge<EdgeData>>()
    const paths: string[][] = []

    const queue: { nodeId: string; depth: number; currentPath: string[] }[] = [
      { nodeId: startNodeId, depth: 0, currentPath: [startNodeId] }
    ]

    while (queue.length > 0) {
      const { nodeId, depth, currentPath } = queue.shift()!

      if (!this.nodesTable.has(nodeId)) continue

      traversedNodeIds.add(nodeId)
      paths.push(currentPath)

      if (depth >= maxDepth) continue

      for (const edge of this.edgesTable.values()) {
        if (edge.from === nodeId) {
          traversedEdges.set(edge.id, JSON.parse(JSON.stringify(edge)))
          const nextNodeId = edge.to
          const visitKey = `${nextNodeId}@${depth + 1}`
          
          if (!visitedNodes.has(visitKey)) {
            visitedNodes.add(visitKey)
            queue.push({
              nodeId: nextNodeId,
              depth: depth + 1,
              currentPath: [...currentPath, nextNodeId]
            })
          }
        }
      }
    }

    const resultNodes: TemporalNode<NodeData>[] = []
    for (const id of traversedNodeIds) {
      const node = this.nodesTable.get(id)
      if (node) resultNodes.push(JSON.parse(JSON.stringify(node)))
    }

    return {
      nodes: resultNodes,
      edges: Array.from(traversedEdges.values()),
      paths
    }
  }

  async syncGraph(nodes: TemporalNode<NodeData>[], edges: TemporalEdge<EdgeData>[]): Promise<void> {
    this.nodesTable.clear()
    this.edgesTable.clear()

    for (const node of nodes) {
      await this.saveNode(node)
    }

    for (const edge of edges) {
      await this.saveEdge(edge)
    }
  }

  async close(): Promise<void> {
    this.isInitialized = false
  }
}
