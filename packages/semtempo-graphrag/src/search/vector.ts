import { SemanticSearchResult, SemanticTemporalNode, VectorSearchConfig } from '../types'
import { EmbeddingProvider } from '../providers/embedding'
import { cosineSimilarity } from './similarity'

export async function searchVector(
  query: string,
  nodes: SemanticTemporalNode[],
  embeddingProvider: EmbeddingProvider,
  config: VectorSearchConfig
): Promise<SemanticSearchResult[]> {
  const queryEmbedding = await embeddingProvider.embed(query)
  const results: SemanticSearchResult[] = []

  for (const node of nodes) {
    const matchedFields: string[] = []
    let maxScore = 0

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

  results.sort((a, b) => b.score - a.score)

  if (results.length === 0 && config.useFallback) {
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

    fallbackResults.sort((a, b) => b.score - a.score)

    if (config.onBelowThreshold) {
      return config.onBelowThreshold(fallbackResults)
    }

    return fallbackResults
  }

  return results
}
