/**
 * Busca por similaridade usando embeddings
 */

import { SemanticSearchResult, SemanticTemporalNode } from '../types'
import { EmbeddingProvider } from '../providers/embedding'

/**
 * Calcula similaridade de cosseno entre dois vetores
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * Busca por similaridade usando embeddings
 */
export async function searchBySimilarity(
  query: string,
  nodes: SemanticTemporalNode[],
  embeddingProvider: EmbeddingProvider,
  threshold: number = 0.7,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  // Gera embedding da query
  const queryEmbedding = await embeddingProvider.embed(query)

  // Calcula similaridade para cada nó
  const results: SemanticSearchResult[] = []

  for (const node of nodes) {
    if (!node.data.embedding) {
      // Se não tem embedding, gera um
      node.data.embedding = await embeddingProvider.embed(node.data.text)
    }

    const similarity = cosineSimilarity(queryEmbedding, node.data.embedding)

    if (similarity >= threshold) {
      results.push({
        node,
        score: similarity,
        matchType: 'similar',
        matchedFields: ['text']
      })
    }
  }

  // Ordena por score (maior primeiro)
  results.sort((a, b) => b.score - a.score)

  // Retorna limitado
  return results.slice(0, limit)
}

