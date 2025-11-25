/**
 * Busca por índices invertidos
 */

import { SemanticSearchResult, SemanticTemporalNode } from '../types'

/**
 * Índice invertido simples
 */
export class InvertedIndex {
  private index: Map<string, Set<string>> = new Map()
  private nodes: Map<string, SemanticTemporalNode> = new Map()

  /**
   * Adiciona um nó ao índice
   */
  addNode(node: SemanticTemporalNode): void {
    this.nodes.set(node.id, node)
    this.indexNode(node)
  }

  /**
   * Remove um nó do índice
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId)
    // Reconstruir índice seria custoso, então apenas marca como removido
    // Em produção, você pode querer manter um índice mais sofisticado
  }

  /**
   * Indexa um nó
   */
  private indexNode(node: SemanticTemporalNode): void {
    const text = node.data.text.toLowerCase()
    const words = text.split(/\s+/).filter(w => w.length > 0)

    for (const word of words) {
      if (!this.index.has(word)) {
        this.index.set(word, new Set())
      }
      this.index.get(word)!.add(node.id)
    }

    // Indexa campos adicionais
    if (node.data.fields) {
      for (const [field, value] of Object.entries(node.data.fields)) {
        if (typeof value === 'string') {
          const fieldWords = value.toLowerCase().split(/\s+/).filter(w => w.length > 0)
          for (const word of fieldWords) {
            const key = `${field}:${word}`
            if (!this.index.has(key)) {
              this.index.set(key, new Set())
            }
            this.index.get(key)!.add(node.id)
          }
        }
      }
    }
  }

  /**
   * Busca por termos
   */
  search(terms: string[]): SemanticSearchResult[] {
    const termSets = terms.map(term => {
      const normalized = term.toLowerCase()
      return this.index.get(normalized) || new Set<string>()
    })

    // Intersecção de todos os termos (AND)
    let resultIds = termSets[0] || new Set<string>()
    for (let i = 1; i < termSets.length; i++) {
      resultIds = new Set([...resultIds].filter(id => termSets[i].has(id)))
    }

    // Se não encontrou com AND, tenta OR
    if (resultIds.size === 0) {
      resultIds = new Set<string>()
      for (const termSet of termSets) {
        for (const id of termSet) {
          resultIds.add(id)
        }
      }
    }

    const results: SemanticSearchResult[] = []
    for (const id of resultIds) {
      const node = this.nodes.get(id)
      if (node) {
        results.push({
          node,
          score: 1.0, // Match exato no índice
          matchType: 'exact',
          matchedFields: ['text']
        })
      }
    }

    return results
  }

  /**
   * Busca por campo específico
   */
  searchByField(field: string, value: string): SemanticSearchResult[] {
    const key = `${field}:${value.toLowerCase()}`
    const nodeIds = this.index.get(key) || new Set<string>()

    const results: SemanticSearchResult[] = []
    for (const id of nodeIds) {
      const node = this.nodes.get(id)
      if (node) {
        results.push({
          node,
          score: 1.0,
          matchType: 'exact',
          matchedFields: [field]
        })
      }
    }

    return results
  }

  /**
   * Reconstrui o índice completo
   */
  rebuild(): void {
    this.index.clear()
    for (const node of this.nodes.values()) {
      this.indexNode(node)
    }
  }
}

/**
 * Busca usando índice invertido
 */
export function searchByIndex(
  query: string,
  index: InvertedIndex
): SemanticSearchResult[] {
  const terms = query.split(/\s+/).filter(t => t.length > 0)
  return index.search(terms)
}

