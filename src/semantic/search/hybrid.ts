/**
 * Busca híbrida combinando múltiplas estratégias
 */

import { SemanticSearchResult, SemanticTemporalNode, SemanticSearchOptions } from '../types'
import { EmbeddingProvider } from '../providers/embedding'
import { searchBySimilarity } from './similarity'
import { searchFuzzy } from './fuzzy'
import { searchSoundex } from './soundex'
import { searchVector } from './vector'
import { VectorSearchConfig } from '../types'

/**
 * Combina resultados de múltiplas buscas
 */
function combineResults(
  results: SemanticSearchResult[],
  weights: Record<string, number> = {}
): SemanticSearchResult[] {
  const combined = new Map<string, SemanticSearchResult & { combinedScore: number }>()

  for (const result of results) {
    const key = result.node.id
    const weight = weights[result.matchType] || 1.0
    const weightedScore = result.score * weight

    if (combined.has(key)) {
      const existing = combined.get(key)!
      existing.combinedScore += weightedScore
      // Atualiza matchedFields
      if (result.matchedFields) {
        existing.matchedFields = [
          ...new Set([...(existing.matchedFields || []), ...result.matchedFields])
        ]
      }
      // Atualiza matchType para hybrid se ainda não for
      if (existing.matchType !== 'hybrid') {
        existing.matchType = 'hybrid'
      }
    } else {
      combined.set(key, {
        ...result,
        combinedScore: weightedScore
      })
    }
  }

  // Converte de volta para SemanticSearchResult e ordena
  return Array.from(combined.values())
    .map(({ combinedScore, ...rest }) => ({
      ...rest,
      score: combinedScore
    }))
    .sort((a, b) => b.score - a.score)
}

/**
 * Busca híbrida combinando múltiplas estratégias
 */
export async function searchHybrid(
  query: string,
  nodes: SemanticTemporalNode[],
  embeddingProvider: EmbeddingProvider,
  options: SemanticSearchOptions
): Promise<SemanticSearchResult[]> {
  const allResults: SemanticSearchResult[] = []
  const weights: Record<string, number> = {
    vector: 1.0,
    similar: 0.9,
    fuzzy: 0.7,
    soundex: 0.5,
    exact: 1.0
  }

  // Busca vetorial/similaridade
  if (options.searchType === 'vector' || options.searchType === 'similarity' || !options.searchType) {
    if (options.fields && options.fields.length > 0) {
      // Busca vetorial em campos específicos
      const vectorConfig: VectorSearchConfig = {
        fields: options.fields,
        threshold: options.threshold || 0.7,
        useFallback: options.useFallback || false,
        onBelowThreshold: options.useFallback
          ? (results) => results.slice(0, options.limit || 10)
          : undefined
      }
      const vectorResults = await searchVector(query, nodes, embeddingProvider, vectorConfig)
      allResults.push(...vectorResults)
    } else {
      // Busca por similaridade geral
      const similarityResults = await searchBySimilarity(
        query,
        nodes,
        embeddingProvider,
        options.threshold || 0.7,
        options.limit || 10
      )
      allResults.push(...similarityResults)
    }
  }

  // Busca fuzzy
  if (options.searchType === 'fuzzy' || options.searchType === 'hybrid') {
    const fuzzyResults = searchFuzzy(
      query,
      nodes,
      options.threshold || 0.6,
      options.limit || 10
    )
    allResults.push(...fuzzyResults)
  }

  // Busca soundex
  if (options.searchType === 'soundex' || options.searchType === 'hybrid') {
    const soundexResults = searchSoundex(query, nodes, options.limit || 10)
    allResults.push(...soundexResults)
  }

  // Combina resultados
  const combined = combineResults(allResults, weights)

  // Remove duplicatas e limita
  const seen = new Set<string>()
  const unique: SemanticSearchResult[] = []

  for (const result of combined) {
    if (!seen.has(result.node.id)) {
      seen.add(result.node.id)
      unique.push(result)
    }
  }

  return unique.slice(0, options.limit || 10)
}

