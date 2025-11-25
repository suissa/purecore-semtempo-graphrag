/**
 * Busca vetorial com suporte a múltiplos campos e fallback
 */

import { SemanticSearchResult, SemanticTemporalNode, VectorSearchConfig } from '../types'
import { EmbeddingProvider } from '../providers/embedding'
import { cosineSimilarity } from './similarity'

/**
 * Busca vetorial em campos específicos
 */
export async function searchVector(
  query: string,
  nodes: SemanticTemporalNode[],
  embeddingProvider: EmbeddingProvider,
  config: VectorSearchConfig
): Promise<SemanticSearchResult[]> {
  // Gera embedding da query
  const queryEmbedding = await embeddingProvider.embed(query)

  const results: SemanticSearchResult[] = []

  for (const node of nodes) {
    const matchedFields: string[] = []
    let maxScore = 0

    // Busca nos campos especificados
    for (const field of config.fields) {
      let fieldText = ''

      if (field === 'text') {
        fieldText = node.data.text
      } else if (node.data.fields && node.data.fields[field]) {
        const value = node.data.fields[field]
        fieldText = typeof value === 'string' ? value : String(value)
      }

      if (fieldText) {
        // Gera ou usa embedding do campo
        let fieldEmbedding: number[]
        
        // Se o campo tem embedding específico no metadata, usa ele
        // Caso contrário, gera um novo
        if (node.data.metadata?.embeddings?.[field]) {
          fieldEmbedding = node.data.metadata.embeddings[field]
        } else {
          fieldEmbedding = await embeddingProvider.embed(fieldText)
          // Armazena no metadata para cache
          if (!node.data.metadata) node.data.metadata = {}
          if (!node.data.metadata.embeddings) node.data.metadata.embeddings = {}
          node.data.metadata.embeddings[field] = fieldEmbedding
        }

        const similarity = cosineSimilarity(queryEmbedding, fieldEmbedding)
        
        if (similarity >= config.threshold) {
          matchedFields.push(field)
          maxScore = Math.max(maxScore, similarity)
        }
      }
    }

    if (maxScore >= config.threshold) {
      results.push({
        node,
        score: maxScore,
        matchType: 'vector',
        matchedFields
      })
    }
  }

  // Ordena por score
  results.sort((a, b) => b.score - a.score)

  // Se não encontrou resultados acima do threshold e useFallback está ativo
  if (results.length === 0 && config.useFallback) {
    // Busca todos os resultados abaixo do threshold
    const fallbackResults: SemanticSearchResult[] = []

    for (const node of nodes) {
      for (const field of config.fields) {
        let fieldText = ''
        if (field === 'text') {
          fieldText = node.data.text
        } else if (node.data.fields && node.data.fields[field]) {
          const value = node.data.fields[field]
          fieldText = typeof value === 'string' ? value : String(value)
        }

        if (fieldText) {
          let fieldEmbedding: number[]
          if (node.data.metadata?.embeddings?.[field]) {
            fieldEmbedding = node.data.metadata.embeddings[field]
          } else {
            fieldEmbedding = await embeddingProvider.embed(fieldText)
            if (!node.data.metadata) node.data.metadata = {}
            if (!node.data.metadata.embeddings) node.data.metadata.embeddings = {}
            node.data.metadata.embeddings[field] = fieldEmbedding
          }

          const similarity = cosineSimilarity(queryEmbedding, fieldEmbedding)
          
          if (similarity > 0) {
            fallbackResults.push({
              node,
              score: similarity,
              matchType: 'vector',
              matchedFields: [field]
            })
          }
        }
      }
    }

    // Ordena fallback results
    fallbackResults.sort((a, b) => b.score - a.score)

    // Aplica callback se fornecido
    if (config.onBelowThreshold) {
      return config.onBelowThreshold(fallbackResults)
    }

    return fallbackResults
  }

  return results
}

