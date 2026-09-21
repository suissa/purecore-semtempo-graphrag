import { SemanticSearchResult, SemanticTemporalNode, SemanticSearchOptions, VectorSearchConfig } from '../types'
import { EmbeddingProvider } from '../providers/embedding'
import { searchBySimilarity } from './similarity'
import { searchFuzzy } from './fuzzy'
import { searchVector } from './vector'

function combineResults(
  results: SemanticSearchResult[],
  weights: Record<string, number> = {}
): SemanticSearchResult[] {
  const combined = new Map<string, SemanticSearchResult & { combinedScore: number; totalWeight: number }>()

  for (const result of results) {
    const key = result.node.id
    const weight = weights[result.matchType] || 1.0
    const weightedScore = result.score * weight

    if (combined.has(key)) {
      const existing = combined.get(key)!
      existing.combinedScore += weightedScore
      existing.totalWeight += weight
      if (result.matchedFields) {
        existing.matchedFields = [
          ...new Set([...(existing.matchedFields || []), ...result.matchedFields])
        ]
      }
      if (existing.matchType !== 'hybrid') {
        existing.matchType = 'hybrid'
      }
    } else {
      combined.set(key, {
        ...result,
        combinedScore: weightedScore,
        totalWeight: weight
      })
    }
  }

  return Array.from(combined.values())
    .map(({ combinedScore, totalWeight, ...rest }) => ({
      ...rest,
      score: totalWeight === 0 ? 0 : combinedScore / totalWeight
    }))
    .sort((a, b) => b.score - a.score)
}

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
    exact: 1.0
  }

  if (options.searchType === 'vector' || options.searchType === 'similarity' || options.searchType === 'hybrid' || !options.searchType) {
    if (options.fields && options.fields.length > 0) {
      const vectorConfig: VectorSearchConfig = {
        fields: options.fields,
        threshold: options.threshold ?? 0.7,
        useFallback: options.useFallback ?? false,
        onBelowThreshold: options.useFallback
          ? (results) => results.slice(0, options.limit ?? 10)
          : undefined
      }
      const vectorResults = await searchVector(query, nodes, embeddingProvider, vectorConfig)
      allResults.push(...vectorResults)
    } else {
      const similarityResults = await searchBySimilarity(
        query,
        nodes,
        embeddingProvider,
        options.threshold ?? 0.7,
        options.limit ?? 10
      )
      allResults.push(...similarityResults)
    }
  }

  if (options.searchType === 'fuzzy' || options.searchType === 'hybrid') {
    const fuzzyResults = searchFuzzy(
      query,
      nodes,
      options.threshold ?? 0.6,
      options.limit ?? 10
    )
    allResults.push(...fuzzyResults)
  }

  const combined = combineResults(allResults, weights)
  const seen = new Set<string>()
  const unique: SemanticSearchResult[] = []

  for (const result of combined) {
    if (!seen.has(result.node.id)) {
      seen.add(result.node.id)
      unique.push(result)
    }
  }

  return unique.slice(0, options.limit ?? 10)
}
