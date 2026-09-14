import { TemporalNode, TemporalEdge } from '../temporalGraph'

export interface StorageTraversalResult<NodeData = any, EdgeData = any> {
  nodes: TemporalNode<NodeData>[]
  edges: TemporalEdge<EdgeData>[]
  paths?: string[][]
}

export interface IGraphStorageAdapter<NodeData = any, EdgeData = any> {
  init(): Promise<void>
  saveNode(node: TemporalNode<NodeData>): Promise<void>
  saveEdge(edge: TemporalEdge<EdgeData>): Promise<void>
  getNode(id: string): Promise<TemporalNode<NodeData> | undefined>
  getEdge(id: string): Promise<TemporalEdge<EdgeData> | undefined>
  getAllNodes(): Promise<TemporalNode<NodeData>[]>
  getAllEdges(): Promise<TemporalEdge<EdgeData>[]>
  deleteNode(id: string): Promise<void>
  deleteEdge(id: string): Promise<void>
  getEdgesInInterval(start: number, end: number): Promise<TemporalEdge<EdgeData>[]>
  bfsTraversal(startNodeId: string, maxDepth?: number): Promise<StorageTraversalResult<NodeData, EdgeData>>
  syncGraph(nodes: TemporalNode<NodeData>[], edges: TemporalEdge<EdgeData>[]): Promise<void>
  close(): Promise<void>
}

export interface SQLiteStorageConfig {
  filename?: string
  autoMigrate?: boolean
}
