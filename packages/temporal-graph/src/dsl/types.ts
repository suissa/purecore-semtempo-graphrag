import { TemporalNode, TemporalEdge } from '../temporalGraph'

export type TraversalDirection = 'outgoing' | 'incoming' | 'both'

export interface TraversalConfig {
  depth?: number
  direction?: TraversalDirection
  maxVisited?: number
}

export type SortStrategy = 'decay' | 'similarity' | 'access' | 'creation'
export type SortDirection = 'asc' | 'desc'

export interface QueryResult<NodeData = any, EdgeData = any> {
  nodes: TemporalNode<NodeData>[]
  edges: TemporalEdge<EdgeData>[]
  paths?: string[][]
  totalNodes: number
  totalEdges: number
}
