import { TemporalGraph, TemporalEdge } from '../temporalGraph'
import { calculateRelevanceScore, DecayOptions, AccessTracker } from './decay'

export interface PruneEdgeOptions extends DecayOptions {
  scoreThreshold?: number
  deactivatedBefore?: number
  currentTime?: number
  removeIsolatedNodes?: boolean
  /** Canonical causal/evidence edges are protected by default. */
  allowEvidenceDeletion?: boolean
  /** Report candidates without mutating the projection. */
  dryRun?: boolean
}

export interface CompressEdgeOptions<EdgeData = any> {
  timeWindowMs?: number
  mergeData?: (dataList: (EdgeData | undefined)[]) => EdgeData | undefined
}

export interface PruneReport {
  edgesRemoved: number
  nodesRemoved: number
  edgesCompressed: number
  candidateEdgeIds: string[]
  protectedEdgeIds: string[]
}

export class GraphPruner<NodeData = any, EdgeData = any> {
  private accessTrackers: Map<string, AccessTracker> = new Map()

  constructor(private graph: TemporalGraph<NodeData, EdgeData>) {}

  recordEdgeAccess(edgeId: string, timestamp: number = Date.now()): void {
    const existing = this.accessTrackers.get(edgeId) || { accessCount: 0, lastAccessedAt: timestamp }
    existing.accessCount += 1
    existing.lastAccessedAt = timestamp
    this.accessTrackers.set(edgeId, existing)
  }

  getEdgeScore(edge: TemporalEdge<EdgeData>, currentTime: number = Date.now(), options: DecayOptions = {}): number {
    const tracker = this.accessTrackers.get(edge.id)
    return calculateRelevanceScore(edge.activated_at, currentTime, tracker, options)
  }

  pruneEdges(options: PruneEdgeOptions = {}): PruneReport {
    const threshold = options.scoreThreshold ?? 0.1
    const currentTime = options.currentTime ?? Date.now()
    const allEdges = this.graph.getAllEdges()

    let edgesRemoved = 0
    const candidateEdgeIds: string[] = []
    const protectedEdgeIds: string[] = []

    for (const edge of allEdges) {
      let shouldPrune = false

      if (options.deactivatedBefore !== undefined && edge.deactivated_at !== undefined) {
        if (edge.deactivated_at <= options.deactivatedBefore) {
          shouldPrune = true
        }
      }

      if (!shouldPrune) {
        const score = this.getEdgeScore(edge, currentTime, options)
        if (score < threshold) {
          shouldPrune = true
        }
      }

      if (shouldPrune) {
        const isEvidence = edge.relation_kind === 'causal' || edge.evidence_refs.length > 0
        if (isEvidence && !options.allowEvidenceDeletion) {
          protectedEdgeIds.push(edge.id)
          continue
        }
        candidateEdgeIds.push(edge.id)
        if (!options.dryRun) {
          this.graph.removeEdge(edge.id)
          this.accessTrackers.delete(edge.id)
          edgesRemoved++
        }
      }
    }

    let nodesRemoved = 0
    if (!options.dryRun && (options.removeIsolatedNodes ?? true)) {
      nodesRemoved = this.pruneIsolatedNodes()
    }

    return { edgesRemoved, nodesRemoved, edgesCompressed: 0, candidateEdgeIds, protectedEdgeIds }
  }

  pruneIsolatedNodes(): number {
    const allNodes = this.graph.getAllNodes()
    const activeNodeIds = new Set<string>()

    for (const edge of this.graph.getAllEdges()) {
      activeNodeIds.add(edge.from)
      activeNodeIds.add(edge.to)
    }

    let nodesRemoved = 0
    for (const node of allNodes) {
      if (!activeNodeIds.has(node.id)) {
        this.graph.removeNode(node.id)
        nodesRemoved++
      }
    }

    return nodesRemoved
  }

  compressTransientEdges(options: CompressEdgeOptions<EdgeData> = {}): number {
    const timeWindow = options.timeWindowMs ?? 60000
    const allEdges = this.graph.getAllEdges()

    const pairs = new Map<string, TemporalEdge<EdgeData>[]>()
    for (const edge of allEdges) {
      if (edge.relation_kind === 'causal' || edge.evidence_refs.length > 0) continue
      const pairKey = `${edge.from}--->${edge.to}`
      const list = pairs.get(pairKey) || []
      list.push(edge)
      pairs.set(pairKey, list)
    }

    let edgesCompressed = 0

    for (const [, edgeList] of pairs) {
      if (edgeList.length <= 1) continue

      edgeList.sort((a, b) => a.activated_at - b.activated_at)

      const clusters: TemporalEdge<EdgeData>[][] = []
      let currentCluster: TemporalEdge<EdgeData>[] = []

      for (const edge of edgeList) {
        if (currentCluster.length === 0) {
          currentCluster.push(edge)
        } else {
          const lastEdge = currentCluster[currentCluster.length - 1]
          if (edge.activated_at - lastEdge.activated_at <= timeWindow) {
            currentCluster.push(edge)
          } else {
            clusters.push(currentCluster)
            currentCluster = [edge]
          }
        }
      }
      if (currentCluster.length > 0) {
        clusters.push(currentCluster)
      }

      for (const cluster of clusters) {
        if (cluster.length <= 1) continue

        const primaryEdge = cluster[0]
        const mergedDataList = cluster.map(e => e.data)
        const mergedData = options.mergeData
          ? options.mergeData(mergedDataList)
          : cluster[cluster.length - 1].data

        const maxDeactivatedAt = Math.max(
          ...cluster.map(e => e.deactivated_at ?? e.activated_at)
        )

        primaryEdge.data = mergedData
        primaryEdge.valid_end = maxDeactivatedAt
        primaryEdge.deactivated_at = maxDeactivatedAt

        for (let i = 1; i < cluster.length; i++) {
          this.graph.removeEdge(cluster[i].id)
          this.accessTrackers.delete(cluster[i].id)
          edgesCompressed++
        }
      }
    }

    return edgesCompressed
  }
}
