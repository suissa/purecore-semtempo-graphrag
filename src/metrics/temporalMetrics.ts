import { TemporalGraph, TemporalEdge } from "../temporalGraph"
import { countIntervalOverlaps } from "./graphMetrics"

/**
 * Conta quantas arestas estavam ativas exatamente em um timestamp.
 */
export function activeEdgeCountAt<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  time: number
): number {
  return graph.getActiveEdgesAt(time).length
}

/**
 * Soma total dos milissegundos ativos de todas as arestas durante [t0, t1].
 * Permite medir "intensidade temporal" do grafo.
 * 
 * Retorna 0 se t1 <= t0.
 */
export function totalActiveTime<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number
): number {
  if (t1 <= t0) return 0
  const edges = graph.getEdgesInInterval(t0, t1)
  let total = 0

  for (const e of edges) {
    let start = Math.max(e.activated_at, t0)
    let end = Math.min(e.deactivated_at ?? t1, t1)
    if (start > end) {
      const tmp = start
      start = end
      end = tmp
    }
    total += Math.max(0, end - start)
  }

  return total
}

/**
 * Tempo médio de ativação de uma aresta (duração média dentro da janela).
 * 
 * Retorna 0 se t1 <= t0 ou se não houver arestas no intervalo.
 */
export function averageActiveDuration<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number
): number {
  if (t1 <= t0) return 0
  const edges = graph.getEdgesInInterval(t0, t1)
  if (edges.length === 0) return 0

  let sum = 0
  for (const e of edges) {
    let start = Math.max(e.activated_at, t0)
    let end = Math.min(e.deactivated_at ?? t1, t1)
    if (start > end) {
      const tmp = start
      start = end
      end = tmp
    }
    sum += Math.max(0, end - start)
  }

  return sum / edges.length
}

/**
 * Mede quantas arestas EXPLODIRAM (ativaram) dentro da janela.
 * Isso indica burst temporal e "avanços" de interação.
 * 
 * Retorna 0 se t1 < t0.
 */
export function activationsInInterval<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number
): number {
  if (t1 < t0) return 0
  return graph.getAllEdges().filter(
    e => e.activated_at >= t0 && e.activated_at <= t1
  ).length
}

/**
 * Mede quantas arestas MORRERAM (desativaram) na janela.
 * Ótimo para identificar perdas, quedas de interação, etc.
 * 
 * Retorna 0 se t1 < t0.
 */
export function deactivationsInInterval<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number
): number {
  if (t1 < t0) return 0
  return graph.getAllEdges().filter(
    e =>
      e.deactivated_at !== undefined &&
      e.deactivated_at >= t0 &&
      e.deactivated_at <= t1
  ).length
}

export interface GraphAliveRatioOptions {
  /**
   * Se true, normaliza a métrica pelo número de arestas presentes no intervalo,
   * garantindo que o valor fique estritamente em [0, 1].
   * 
   * Se false (ou omitido), retorna totalActiveTime / windowDuration, representando
   * o número médio de arestas concorrentes ativas durante a janela (pode ser > 1
   * quando múltiplas arestas coexistem).
   */
  normalize?: boolean
}

/**
 * Quão "vivo" está o grafo dentro da janela [t0, t1].
 * 
 * Sem normalização (padrão):
 * alive_ratio = totalTempoAtivo / duraçãoDaJanela
 * Representa o número médio de arestas ativas concorrentes durante a janela.
 * 
 * Com normalização (options.normalize = true):
 * alive_ratio = totalTempoAtivo / (duraçãoDaJanela * totalArestasNoIntervalo)
 * Normalizado no intervalo [0, 1].
 * 
 * Edge cases:
 * - Se t1 <= t0 (janela vazia ou timestamps invertidos), retorna 0.
 * - Se não existirem arestas no intervalo, retorna 0.
 */
export function graphAliveRatio<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number,
  options?: GraphAliveRatioOptions
): number {
  if (t1 <= t0) return 0
  const interval = t1 - t0
  const active = totalActiveTime(graph, t0, t1)

  if (options?.normalize) {
    const edgesCount = graph.getEdgesInInterval(t0, t1).length
    if (edgesCount === 0) return 0
    return active / (interval * edgesCount)
  }

  return active / interval
}

export interface TemporalAccelerationOptions {
  /**
   * Se true, divide a variação de arestas pela duração da janela em minutos,
   * calculando a taxa de aceleração temporal contínua (Δedges / min).
   * 
   * Se false (ou omitido), calcula a variação líquida discreta entre os instantes (a1 - a0).
   */
  perMinute?: boolean
}

/**
 * Mudança na quantidade de arestas ativas entre dois instantes t0 e t1.
 * Mede aceleração temporal.
 * 
 * Por padrão, retorna a variação líquida (a1 - a0).
 * Se options?.perMinute for true, calcula a taxa de variação por minuto:
 * (a1 - a0) / ((t1 - t0) / 60_000).
 * 
 * Edge cases:
 * - Se t1 <= t0 (janela vazia ou timestamps invertidos), retorna 0.
 */
export function temporalAcceleration<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number,
  options?: TemporalAccelerationOptions
): number {
  if (t1 <= t0) return 0
  const a0 = activeEdgeCountAt(graph, t0)
  const a1 = activeEdgeCountAt(graph, t1)
  const delta = a1 - a0

  if (options?.perMinute) {
    const windowMinutes = (t1 - t0) / 60_000
    if (windowMinutes === 0) return 0
    return delta / windowMinutes
  }

  return delta
}

/**
 * Retorna o snapshot do grafo em um instante t, como listas de nós e arestas ativas.
 */
export function temporalSnapshot<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  time: number
) {
  return {
    nodes: graph.getAllNodes(),
    activeEdges: graph.getActiveEdgesAt(time)
  }
}

/**
 * Intensidade temporal:
 * Número de eventos por unidade de tempo (ms → min).
 * 
 * Retorna 0 se t1 <= t0.
 */
export function temporalIntensity<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number
): number {
  if (t1 <= t0) return 0

  const edges = graph.getEdgesInInterval(t0, t1).length
  const windowMinutes = (t1 - t0) / 60_000
  if (windowMinutes === 0) return 0
  return edges / windowMinutes
}

/**
 * Tempo médio entre ativações sucessivas do grafo (toda vez que qualquer aresta ativa).
 * Indica ritmo global do grafo.
 */
export function activationRhythm<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>
): number {
  const times = graph
    .getAllEdges()
    .map(e => e.activated_at)
    .sort((a, b) => a - b)

  if (times.length < 2) return 0

  const intervals: number[] = []
  for (let i = 0; i < times.length - 1; i++) {
    intervals.push(times[i + 1] - times[i])
  }

  const sum = intervals.reduce((a, b) => a + b, 0)
  return sum / intervals.length
}

/**
 * Percentual de overlap temporal entre todas as arestas dentro da janela [t0, t1].
 * 
 * Complexidade:
 * - Naive (padrão): Tempo O(n^2), onde n é o número de arestas no intervalo; Espaço O(n).
 * - Fast: Tempo O(n log n), Espaço O(n).
 * 
 * Retorna 0 se t1 <= t0 ou se existirem 0 ou 1 arestas.
 */
export function temporalOverlapRatio<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number,
  options?: { algorithm?: 'naive' | 'fast' }
): number {
  if (t1 <= t0) return 0
  if (options?.algorithm === 'fast') {
    return temporalOverlapRatioFast(graph, t0, t1)
  }

  const edges = graph.getEdgesInInterval(t0, t1)
  if (edges.length <= 1) return 0

  let overlaps = 0

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i]
      const b = edges[j]

      let aStart = a.activated_at
      let aEnd = a.deactivated_at ?? Infinity
      let bStart = b.activated_at
      let bEnd = b.deactivated_at ?? Infinity

      if (aStart > aEnd) {
        const tmp = aStart
        aStart = aEnd
        aEnd = tmp
      }
      if (bStart > bEnd) {
        const tmp = bStart
        bStart = bEnd
        bEnd = tmp
      }

      const overlap = aEnd >= bStart && bEnd >= aStart
      if (overlap) overlaps++
    }
  }

  const totalPairs = (edges.length * (edges.length - 1)) / 2
  return overlaps / totalPairs
}

/**
 * Versão O(n log n) do percentual de overlap temporal entre arestas na janela [t0, t1].
 * 
 * Complexidade:
 * - Tempo: O(n log n)
 * - Espaço: O(n)
 */
export function temporalOverlapRatioFast<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number
): number {
  if (t1 <= t0) return 0
  const edges = graph.getEdgesInInterval(t0, t1)
  if (edges.length <= 1) return 0

  const overlaps = countIntervalOverlaps(edges)
  const totalPairs = (edges.length * (edges.length - 1)) / 2
  return overlaps / totalPairs
}

/**
 * Mede quantas mudanças (ativação + desativação) o grafo sofreu por minuto.
 * É um índice de dinamismo.
 * 
 * Retorna 0 se t1 <= t0.
 */
export function temporalChangeRate<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number
): number {
  if (t1 <= t0) return 0

  const activations = activationsInInterval(graph, t0, t1)
  const deactivations = deactivationsInInterval(graph, t0, t1)
  const total = activations + deactivations

  const windowMinutes = (t1 - t0) / 60_000
  if (windowMinutes === 0) return 0
  return total / windowMinutes
}

