import { TemporalGraph, TemporalEdge, TemporalNode } from '../temporalGraph'
import { TraversalConfig, SortStrategy, SortDirection, QueryResult } from './types'
import { GraphPruner } from '../pruning/graphPruner'

export class GraphQueryBuilder<NodeData = any, EdgeData = any> {
  private startTime?: number
  private endTime?: number
  private activeAtTime?: number
  private startNodeIds: Set<string> = new Set()
  private traversalConfig?: TraversalConfig
  private nodePredicates: ((node: TemporalNode<NodeData>) => boolean)[] = []
  private edgePredicates: ((edge: TemporalEdge<EdgeData>) => boolean)[] = []
  private sortRule?: { strategy: SortStrategy; direction: SortDirection }
  private limitValue?: number
  private offsetValue?: number

  constructor(
    private targetGraph: TemporalGraph<NodeData, EdgeData> | any,
    private pruner?: GraphPruner<NodeData, EdgeData>
  ) {}

  withinTimeRange(start: number, end: number): this {
    this.startTime = start
    this.endTime = end
    return this
  }

  activeAt(timestamp: number): this {
    this.activeAtTime = timestamp
    return this
  }

  fromNode(nodeId: string): this {
    this.startNodeIds.add(nodeId)
    return this
  }

  fromNodes(nodeIds: string[]): this {
    for (const id of nodeIds) {
      this.startNodeIds.add(id)
    }
    return this
  }

  traverse(config: TraversalConfig = {}): this {
    this.traversalConfig = {
      depth: config.depth ?? 1,
      direction: config.direction ?? 'outgoing',
      maxVisited: config.maxVisited ?? 1000
    }
    return this
  }

  filterNode(predicate: (node: TemporalNode<NodeData>) => boolean): this {
    this.nodePredicates.push(predicate)
    return this
  }

  filterEdge(predicate: (edge: TemporalEdge<EdgeData>) => boolean): this {
    this.edgePredicates.push(predicate)
    return this
  }

  sortByScore(strategy: SortStrategy, direction: SortDirection = 'desc'): this {
    this.sortRule = { strategy, direction }
    return this
  }

  limit(limit: number): this {
    this.limitValue = limit
    return this
  }

  offset(offset: number): this {
    this.offsetValue = offset
    return this
  }

  async execute(): Promise<QueryResult<NodeData, EdgeData>> {
    const rawGraph: TemporalGraph<NodeData, EdgeData> =
      'getGraph' in this.targetGraph ? this.targetGraph.getGraph() : this.targetGraph

    let candidateNodes: TemporalNode<NodeData>[] = rawGraph.getAllNodes()
    let candidateEdges: TemporalEdge<EdgeData>[] = rawGraph.getAllEdges()
    let paths: string[][] = []

    if (this.activeAtTime !== undefined) {
      candidateEdges = rawGraph.getActiveEdgesAt(this.activeAtTime)
    } else if (this.startTime !== undefined && this.endTime !== undefined) {
      candidateEdges = rawGraph.getEdgesInInterval(this.startTime, this.endTime)
    }

    if (this.startNodeIds.size > 0) {
      if (this.traversalConfig) {
        const depth = this.traversalConfig.depth ?? 1
        const visitedNodeIds = new Set<string>()
        const traversedEdgeIds = new Set<string>()
        const queue: { id: string; currentDepth: number; path: string[] }[] = []

        for (const startId of this.startNodeIds) {
          queue.push({ id: startId, currentDepth: 0, path: [startId] })
        }

        while (queue.length > 0) {
          const { id, currentDepth, path } = queue.shift()!
          visitedNodeIds.add(id)
          paths.push(path)

          if (currentDepth >= depth) continue

          for (const edge of candidateEdges) {
            let nextId: string | undefined
            if (
              (this.traversalConfig.direction === 'outgoing' || this.traversalConfig.direction === 'both') &&
              edge.from === id
            ) {
              nextId = edge.to
            } else if (
              (this.traversalConfig.direction === 'incoming' || this.traversalConfig.direction === 'both') &&
              edge.to === id
            ) {
              nextId = edge.from
            }

            if (nextId) {
              traversedEdgeIds.add(edge.id)
              if (!visitedNodeIds.has(nextId)) {
                queue.push({ id: nextId, currentDepth: currentDepth + 1, path: [...path, nextId] })
              }
            }
          }
        }

        candidateNodes = candidateNodes.filter(n => visitedNodeIds.has(n.id))
        candidateEdges = candidateEdges.filter(e => traversedEdgeIds.has(e.id))
      } else {
        candidateNodes = candidateNodes.filter(n => this.startNodeIds.has(n.id))
      }
    }

    for (const predicate of this.nodePredicates) {
      candidateNodes = candidateNodes.filter(predicate)
    }

    for (const predicate of this.edgePredicates) {
      candidateEdges = candidateEdges.filter(predicate)
    }

    if (this.sortRule) {
      const { strategy, direction } = this.sortRule
      const mul = direction === 'desc' ? -1 : 1

      if (strategy === 'decay' && this.pruner) {
        const pruner = this.pruner
        candidateEdges.sort((a, b) => mul * (pruner.getEdgeScore(a) - pruner.getEdgeScore(b)))
      } else if (strategy === 'creation') {
        candidateNodes.sort((a, b) => mul * (a.id.localeCompare(b.id)))
        candidateEdges.sort((a, b) => mul * (a.created_at - b.created_at))
      }
    }

    const totalNodes = candidateNodes.length
    const totalEdges = candidateEdges.length

    if (this.offsetValue) {
      candidateNodes = candidateNodes.slice(this.offsetValue)
      candidateEdges = candidateEdges.slice(this.offsetValue)
    }

    if (this.limitValue) {
      candidateNodes = candidateNodes.slice(0, this.limitValue)
      candidateEdges = candidateEdges.slice(0, this.limitValue)
    }

    return {
      nodes: candidateNodes,
      edges: candidateEdges,
      paths: paths.length > 0 ? paths : undefined,
      totalNodes,
      totalEdges
    }
  }

  async executeNodes(): Promise<TemporalNode<NodeData>[]> {
    const res = await this.execute()
    return res.nodes
  }

  async executePaths(): Promise<string[][]> {
    const res = await this.execute()
    return res.paths ?? []
  }
}
