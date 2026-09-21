import { EdgeAlreadyExistsError, InvalidTemporalIntervalError, NodeAlreadyExistsError, NodeDoesntExistError } from './errors'
import hash from 'object-hash'

/** Half-open valid-time interval: valid_start <= t < valid_end. */
export interface ValidTime {
  valid_start: number
  valid_end?: number
}

export interface ObservationTime {
  /** Time claimed by the originating event/domain. */
  event_time: number
  /** Time the runtime first observed the record. */
  observed_at: number
  /** Time the record entered this graph projection. */
  ingested_at: number
}

export type TemporalRelationKind =
  | 'adjacency'
  | 'causal'
  | 'semantic'
  | 'behavioral'
  | 'observational'

export type EvidenceKind = 'event' | 'trace' | 'log' | 'metric' | 'message' | 'explicit'

export interface EvidenceRef {
  kind: EvidenceKind
  id: string
  source?: string
}

export interface TemporalNodeOptions extends Partial<ValidTime>, Partial<ObservationTime> {}

export interface TemporalEdgeOptions extends Partial<ObservationTime> {
  id?: string
  relation_kind?: TemporalRelationKind
  evidence_refs?: EvidenceRef[]
  event_id?: string
  causation_id?: string
  correlation_id?: string
  trace_id?: string
  span_id?: string
}

export interface TemporalNode<T = any> {
  id: string
  data: T
  valid_start?: number
  valid_end?: number
  event_time?: number
  observed_at?: number
  ingested_at?: number
}

export interface TemporalEdge<T = any> extends ValidTime, ObservationTime {
  id: string
  from: string
  to: string
  relation_kind: TemporalRelationKind
  evidence_refs: EvidenceRef[]
  event_id?: string
  causation_id?: string
  correlation_id?: string
  trace_id?: string
  span_id?: string

  /** @deprecated Use ingested_at. */
  created_at: number
  /** @deprecated Use valid_start. */
  activated_at: number
  /** @deprecated Use valid_end. */
  deactivated_at?: number
  data?: T
}

export interface TemporalGraphOptions {
  clock?: () => number
}

function assertInterval(start: number, end?: number): void {
  if (!Number.isFinite(start) || (end !== undefined && (!Number.isFinite(end) || end <= start))) {
    throw new InvalidTemporalIntervalError(start, end)
  }
}

function overlapsHalfOpen(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export class TemporalGraph<NodeData = any, EdgeData = any> {
  private nodes: Map<string, TemporalNode<NodeData>> = new Map()
  private edges: Map<string, TemporalEdge<EdgeData>> = new Map()
  private adjacency: Map<string, Set<string>> = new Map()
  private readonly clock: () => number

  constructor(
    private identityFn: (data: NodeData) => string,
    options: TemporalGraphOptions = {}
  ) {
    this.clock = options.clock ?? Date.now
  }

  insertNode(data: NodeData, options: TemporalNodeOptions = {}): TemporalNode<NodeData> {
    const id = this.identityFn(data)
    const existingNode = this.nodes.get(id)
    if (existingNode) throw new NodeAlreadyExistsError<NodeData>(data, existingNode.data, id)
    if (options.valid_start !== undefined) assertInterval(options.valid_start, options.valid_end)

    const now = this.clock()
    const node: TemporalNode<NodeData> = {
      id,
      data,
      ...options,
      event_time: options.event_time ?? options.valid_start,
      observed_at: options.observed_at ?? now,
      ingested_at: options.ingested_at ?? now
    }
    this.nodes.set(id, node)
    this.adjacency.set(id, new Set())
    return node
  }

  getNode(id: string): TemporalNode<NodeData> | undefined { return this.nodes.get(id) }
  hasNode(id: string): boolean { return this.nodes.has(id) }
  getAllNodes(): TemporalNode<NodeData>[] { return [...this.nodes.values()] }

  private ensureNodeExists(id: string): void {
    if (!this.nodes.has(id)) throw new NodeDoesntExistError(id)
  }

  addTemporalEdge(
    from: string | NodeData,
    to: string | NodeData,
    validStart: number,
    data?: EdgeData,
    validEnd?: number,
    options: TemporalEdgeOptions = {}
  ): TemporalEdge<EdgeData> {
    const fromId = typeof from === 'string' ? from : this.identityFn(from)
    const toId = typeof to === 'string' ? to : this.identityFn(to)
    this.ensureNodeExists(fromId)
    this.ensureNodeExists(toId)
    assertInterval(validStart, validEnd)

    const now = this.clock()
    const relationKind = options.relation_kind ?? 'adjacency'
    const evidenceRefs = [...(options.evidence_refs ?? [])]
    if (relationKind === 'causal' && evidenceRefs.length === 0 && !options.causation_id) {
      throw new Error('Causal edges require evidence_refs or causation_id')
    }

    const id = options.id ?? hash({
      from: fromId,
      to: toId,
      valid_start: validStart,
      valid_end: validEnd ?? null,
      relation_kind: relationKind,
      event_id: options.event_id ?? null,
      evidence_refs: evidenceRefs,
      data: data ?? null
    })
    if (this.edges.has(id)) throw new EdgeAlreadyExistsError(id)

    const ingestedAt = options.ingested_at ?? now
    const edge: TemporalEdge<EdgeData> = {
      id,
      from: fromId,
      to: toId,
      valid_start: validStart,
      valid_end: validEnd,
      event_time: options.event_time ?? validStart,
      observed_at: options.observed_at ?? now,
      ingested_at: ingestedAt,
      relation_kind: relationKind,
      evidence_refs: evidenceRefs,
      event_id: options.event_id,
      causation_id: options.causation_id,
      correlation_id: options.correlation_id,
      trace_id: options.trace_id,
      span_id: options.span_id,
      created_at: ingestedAt,
      activated_at: validStart,
      deactivated_at: validEnd,
      data
    }

    this.edges.set(id, edge)
    this.adjacency.get(fromId)!.add(id)
    return edge
  }

  deactivateEdge(edgeId: string, validEnd: number): void {
    const edge = this.edges.get(edgeId)
    if (!edge) return
    assertInterval(edge.valid_start, validEnd)
    edge.valid_end = validEnd
    edge.deactivated_at = validEnd
  }

  getAllEdges(): TemporalEdge<EdgeData>[] { return [...this.edges.values()] }

  getActiveEdgesAt(time: number): TemporalEdge<EdgeData>[] {
    return [...this.edges.values()].filter(e => e.valid_start <= time && time < (e.valid_end ?? Infinity))
  }

  getEdgesInInterval(start: number, end: number): TemporalEdge<EdgeData>[] {
    assertInterval(start, end)
    return [...this.edges.values()].filter(e =>
      overlapsHalfOpen(e.valid_start, e.valid_end ?? Infinity, start, end)
    )
  }

  getEdgesObservedAt(asOf: number): TemporalEdge<EdgeData>[] {
    return [...this.edges.values()].filter(e => e.observed_at <= asOf)
  }

  getOutgoingEdges(nodeId: string): TemporalEdge<EdgeData>[] {
    this.ensureNodeExists(nodeId)
    const result: TemporalEdge<EdgeData>[] = []
    for (const id of this.adjacency.get(nodeId) ?? []) {
      const edge = this.edges.get(id)
      if (edge) result.push(edge)
    }
    return result
  }

  /** Earliest-arrival, time-respecting path. Waiting at a node is allowed. */
  temporalShortestPath(start: string, end: string, departureTime = -Infinity): string[] | null {
    this.ensureNodeExists(start)
    this.ensureNodeExists(end)
    const bestArrival = new Map<string, number>([[start, departureTime]])
    const queue: { node: string; time: number; path: string[] }[] = [
      { node: start, time: departureTime, path: [start] }
    ]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current.node === end) return current.path

      for (const edge of this.getOutgoingEdges(current.node)) {
        const traversalTime = Math.max(current.time, edge.valid_start)
        if (traversalTime >= (edge.valid_end ?? Infinity)) continue
        const knownArrival = bestArrival.get(edge.to)
        if (knownArrival !== undefined && knownArrival <= traversalTime) continue
        bestArrival.set(edge.to, traversalTime)
        queue.push({ node: edge.to, time: traversalTime, path: [...current.path, edge.to] })
      }
    }
    return null
  }

  getEdge(id: string): TemporalEdge<EdgeData> | undefined { return this.edges.get(id) }

  removeEdge(id: string): boolean {
    const edge = this.edges.get(id)
    if (!edge) return false
    this.edges.delete(id)
    this.adjacency.get(edge.from)?.delete(id)
    return true
  }

  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false
    for (const [edgeId, edge] of [...this.edges.entries()]) {
      if (edge.from === id || edge.to === id) this.removeEdge(edgeId)
    }
    this.nodes.delete(id)
    this.adjacency.delete(id)
    return true
  }
}
