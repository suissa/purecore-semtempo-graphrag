import { TemporalGraph } from '../temporalGraph'

/**
 * Grau temporal de um nó em [t0, t1].
 * Retorna 0 se t1 <= t0 ou se o nó for isolado.
 */
export function temporalDegree<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  nodeId: string,
  t0: number,
  t1: number
): number {
  if (t1 <= t0) return 0
  const edges = graph.getEdgesInInterval(t0, t1)
  return edges.filter(e => e.from === nodeId || e.to === nodeId).length
}

export interface NodeLifespanOptions {
  /**
   * Timestamp de referência para arestas abertas (onde deactivated_at é undefined).
   * Se omitido, a aresta aberta tem como término o seu próprio timestamp de ativação
   * (ou o valor de `now` fornecido).
   */
  now?: number
}

/**
 * Lifespan do nó (da primeira atividade até a última atividade observada).
 * Considera tanto `activated_at` quanto `deactivated_at` de todas as arestas
 * conectadas ao nó (incidentes ou saintes).
 * 
 * Se uma aresta estiver aberta (deactivated_at === undefined):
 * - Caso `now` (ou options.now) seja fornecido, ele é considerado o término da aresta.
 * - Caso contrário, o término considerado é o próprio activated_at daquela aresta.
 * 
 * Retorna 0 se o nó for isolado, não possuir arestas ou se a duração for <= 0.
 */
export function nodeLifespan<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  nodeId: string,
  nowOrOptions?: number | NodeLifespanOptions
): number {
  const now = typeof nowOrOptions === 'number' ? nowOrOptions : nowOrOptions?.now
  const edges = graph.getAllEdges().filter(
    e => e.from === nodeId || e.to === nodeId
  )
  if (edges.length === 0) return 0

  let minTime = Infinity
  let maxTime = -Infinity

  for (const e of edges) {
    let start = e.activated_at
    let end = e.deactivated_at ?? (now !== undefined ? now : e.activated_at)

    // Trata timestamps invertidos na própria aresta
    if (start > end) {
      const tmp = start
      start = end
      end = tmp
    }

    if (start < minTime) minTime = start
    if (end > maxTime) maxTime = end
  }

  if (minTime === Infinity || maxTime === -Infinity || maxTime <= minTime) {
    return 0
  }

  return maxTime - minTime
}

/**
 * Burstiness de Barabási adaptado:
 * B = (σ - μ) / (σ + μ)
 * Quanto mais perto de 1 → mais bursty
 */
export function nodeBurstiness<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  nodeId: string
): number {
  const times = graph
    .getAllEdges()
    .filter(e => e.from === nodeId || e.to === nodeId)
    .map(e => e.activated_at)
    .sort((a, b) => a - b)

  if (times.length < 3) return 0

  const deltas: number[] = []
  for (let i = 0; i < times.length - 1; i++) {
    deltas.push(times[i + 1] - times[i])
  }

  const mean =
    deltas.reduce((acc, v) => acc + v, 0) / deltas.length

  if (mean === 0) return 0

  const variance =
    deltas.reduce((acc, v) => acc + (v - mean) ** 2, 0) / deltas.length

  const std = Math.sqrt(variance)
  if (std + mean === 0) return 0

  return (std - mean) / (std + mean)
}

