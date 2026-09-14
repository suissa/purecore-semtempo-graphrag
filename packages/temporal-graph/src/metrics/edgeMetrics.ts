import { TemporalGraph, TemporalEdge } from '../temporalGraph'

/**
 * Duração de um intervalo de aresta.
 * Se estiver ativa, usa `now`.
 */
export function edgeDuration<T = any>(
  edge: TemporalEdge<T>,
  now: number = Date.now()
): number {
  const end = edge.deactivated_at ?? now
  return end - edge.activated_at
}

/**
 * Média de duração de todas as arestas entre dois nós (from → to)
 */
export function averageEdgeDurationBetween<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  fromId: string,
  toId: string,
  now: number = Date.now()
): number {
  const edges = graph
    .getAllEdges()
    .filter(e => e.from === fromId && e.to === toId)

  if (edges.length === 0) return 0

  const total = edges.reduce(
    (acc, e) => acc + edgeDuration(e, now),
    0
  )
  return total / edges.length
}

/**
 * Contagem de recorrência de uma relação (from → to)
 */
export function edgeRecurrence<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  fromId: string,
  toId: string
): number {
  return graph
    .getAllEdges()
    .filter(e => e.from === fromId && e.to === toId).length
}
