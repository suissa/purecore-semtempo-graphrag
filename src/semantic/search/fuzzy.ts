/**
 * Busca fuzzy (aproximada) usando algoritmo de Levenshtein
 */

import { SemanticSearchResult, SemanticTemporalNode } from '../types'

/**
 * Calcula distância de Levenshtein entre duas strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calcula similaridade fuzzy (0-1)
 */
export function fuzzySimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length)
  if (maxLength === 0) return 1

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  return 1 - distance / maxLength
}

/**
 * Busca fuzzy em nós
 */
export function searchFuzzy(
  query: string,
  nodes: SemanticTemporalNode[],
  threshold: number = 0.6,
  limit: number = 10
): SemanticSearchResult[] {
  const results: SemanticSearchResult[] = []

  for (const node of nodes) {
    // Busca no texto principal
    const textSimilarity = fuzzySimilarity(query, node.data.text)
    
    // Busca nos campos adicionais
    let maxSimilarity = textSimilarity
    const matchedFields: string[] = []

    if (textSimilarity >= threshold) {
      matchedFields.push('text')
    }

    if (node.data.fields) {
      for (const [field, value] of Object.entries(node.data.fields)) {
        if (typeof value === 'string') {
          const fieldSimilarity = fuzzySimilarity(query, value)
          if (fieldSimilarity >= threshold) {
            matchedFields.push(field)
          }
          maxSimilarity = Math.max(maxSimilarity, fieldSimilarity)
        }
      }
    }

    if (maxSimilarity >= threshold) {
      results.push({
        node,
        score: maxSimilarity,
        matchType: 'fuzzy',
        matchedFields: matchedFields.length > 0 ? matchedFields : ['text']
      })
    }
  }

  // Ordena por score
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}

