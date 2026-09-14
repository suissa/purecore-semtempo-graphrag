import { TemporalGraph } from '../temporalGraph'

export interface TemporalDensityOptions {
  /**
   * 'pairs' (padrão): fração de pares direcionados únicos (u, v) com u != v ativos em [t0, t1]. Valor em [0, 1].
   * 'time': densidade espaço-temporal contínua = totalTempoAtivo / (n * (n - 1) * (t1 - t0)). Valor em [0, 1].
   * 'raw': arestas brutas no intervalo / (n * (n - 1)), mantendo compatibilidade direta se desejado.
   */
  mode?: 'pairs' | 'time' | 'raw'
}

/**
 * Quantidade de arestas ativas em [t0, t1] normalizada pelo número
 * máximo possível de arestas (n * (n-1)), ignorando self-loop.
 * 
 * Complexidade:
 * - Tempo: O(|E|), onde |E| é o número de arestas do grafo.
 * - Espaço: O(|V_active|) para rastrear pares únicos.
 * 
 * Edge cases:
 * - Se t1 <= t0 (janela vazia ou timestamps invertidos), retorna 0.
 * - Se o número de nós n <= 1, retorna 0.
 * - Em multigrafos, no modo 'pairs' (padrão), múltiplos eventos entre o mesmo par
 *   são agrupados para garantir que a densidade permaneça em [0, 1].
 */
export function temporalDensity<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  t0: number,
  t1: number,
  options?: TemporalDensityOptions
): number {
  if (t1 <= t0) return 0

  const nodes = graph.getAllNodes()
  const n = nodes.length
  if (n <= 1) return 0

  const maxPossible = n * (n - 1) // directed graph, sem self-loop
  const edgesInInterval = graph.getEdgesInInterval(t0, t1)

  const mode = options?.mode ?? 'pairs'

  if (mode === 'time') {
    let totalActive = 0
    for (const e of edgesInInterval) {
      const start = Math.max(e.activated_at, t0)
      const end = Math.min(e.deactivated_at ?? t1, t1)
      totalActive += Math.max(0, end - start)
    }
    const windowDuration = t1 - t0
    return totalActive / (maxPossible * windowDuration)
  }

  if (mode === 'raw') {
    return edgesInInterval.length / maxPossible
  }

  // mode === 'pairs' (padrão seguro)
  const activePairs = new Set<string>()
  for (const e of edgesInInterval) {
    if (e.from !== e.to) {
      activePairs.add(`${e.from}->${e.to}`)
    }
  }

  return activePairs.size / maxPossible
}

/**
 * Função utilitária para contar sobreposições de intervalos em O(n log n).
 * 
 * Dois intervalos [s_i, e_i] e [s_j, e_j] se sobrepõem se e_i >= s_j e e_j >= s_i.
 * De forma complementar, não se sobrepõem se um termina estritamente antes do outro começar (e_i < s_j ou e_j < s_i).
 * 
 * Complexidade:
 * - Tempo: O(n log n) devido à ordenação dos timestamps de início e fim.
 * - Espaço: O(n) para alocação dos vetores de timestamps.
 */
export function countIntervalOverlaps(
  intervals: Array<{ activated_at: number; deactivated_at?: number }>
): number {
  const n = intervals.length
  if (n <= 1) return 0

  const starts: number[] = new Array(n)
  const ends: number[] = new Array(n)

  for (let i = 0; i < n; i++) {
    const item = intervals[i]
    let s = item.activated_at
    let e = item.deactivated_at ?? Infinity

    // Se timestamps estiverem invertidos na própria aresta, normaliza min e max
    if (s > e) {
      const tmp = s
      s = e
      e = tmp
    }

    starts[i] = s
    ends[i] = e
  }

  starts.sort((a, b) => a - b)
  ends.sort((a, b) => a - b)

  let nonOverlaps = 0
  let endIdx = 0

  // Para cada início, conta quantos intervalos já terminaram estritamente antes deste início
  for (let i = 0; i < n; i++) {
    const s = starts[i]
    while (endIdx < n && ends[endIdx] < s) {
      endIdx++
    }
    nonOverlaps += endIdx
  }

  const totalPairs = (n * (n - 1)) / 2
  return totalPairs - nonOverlaps
}

/**
 * Overlap de intervalos de arestas (quantos pares se sobrepõem no tempo).
 * 
 * Complexidade:
 * - Naive (padrão): Tempo O(n^2), onde n é o número total de arestas; Espaço O(n).
 * - Fast: Tempo O(n log n), Espaço O(n).
 */
export function edgeOverlapCount<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>,
  options?: { algorithm?: 'naive' | 'fast' }
): number {
  if (options?.algorithm === 'fast') {
    return edgeOverlapCountFast(graph)
  }

  const edges = graph.getAllEdges()
  let count = 0

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
      if (overlap) count++
    }
  }

  return count
}

/**
 * Versão O(n log n) para contagem de overlap de intervalos de arestas.
 * Utiliza o algoritmo sweep-line / two-pointer sobre timestamps ordenados.
 * 
 * Complexidade:
 * - Tempo: O(n log n)
 * - Espaço: O(n)
 */
export function edgeOverlapCountFast<NodeData, EdgeData>(
  graph: TemporalGraph<NodeData, EdgeData>
): number {
  return countIntervalOverlaps(graph.getAllEdges())
}

/**
 * "Velocidade" de interação: número de arestas em [t0, t1]
 * dividido pela largura da janela (em minutos).
 * 
 * Complexidade:
 * - Tempo: O(|E|)
 * - Espaço: O(|E_interval|)
 * 
 * Retorna 0 se t1 <= t0 (janela vazia ou invertida).
 */
export function interactionVelocity<NodeData, EdgeData>(
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

