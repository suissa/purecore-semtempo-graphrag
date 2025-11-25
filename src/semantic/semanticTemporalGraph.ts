/**
 * Grafo temporal semântico com busca avançada
 */

import { TemporalGraph } from '../temporalGraph'
import {
  SemanticNodeData,
  SemanticEdgeData,
  SemanticTemporalNode,
  SemanticTemporalEdge,
  SemanticSearchOptions,
  SemanticSearchResult,
  VectorSearchConfig,
  EmbeddingProviderConfig,
  LLMProviderConfig
} from './types'
import { EmbeddingProvider, createEmbeddingProvider } from './providers/embedding'
import { LLMProvider, createLLMProvider } from './providers/llm'
import { searchBySimilarity } from './search/similarity'
import { searchFuzzy } from './search/fuzzy'
import { searchSoundex } from './search/soundex'
import { searchVector } from './search/vector'
import { searchHybrid } from './search/hybrid'
import { InvertedIndex, searchByIndex } from './search/index'

/**
 * Grafo temporal semântico
 */
export class SemanticTemporalGraph<NodeData extends SemanticNodeData = SemanticNodeData, EdgeData extends SemanticEdgeData = SemanticEdgeData> {
  private graph: TemporalGraph<NodeData, EdgeData>
  private embeddingProvider?: EmbeddingProvider
  private llmProvider?: LLMProvider
  private index: InvertedIndex

  constructor(identityFn: (data: NodeData) => string) {
    this.graph = new TemporalGraph<NodeData, EdgeData>(identityFn)
    this.index = new InvertedIndex()
  }

  /**
   * Configura provedor de embeddings
   */
  setEmbeddingProvider(config: EmbeddingProviderConfig): void {
    this.embeddingProvider = createEmbeddingProvider(config)
  }

  /**
   * Configura provedor de LLM
   */
  setLLMProvider(config: LLMProviderConfig): void {
    this.llmProvider = createLLMProvider(config)
  }

  /**
   * Insere um nó com dados semânticos
   */
  async insertNode(data: NodeData): Promise<SemanticTemporalNode> {
    // Gera embedding se não existir e provider estiver configurado
    if (!data.embedding && this.embeddingProvider) {
      data.embedding = await this.embeddingProvider.embed(data.text)
    }

    const node = this.graph.insertNode(data)
    
    // Adiciona ao índice
    this.index.addNode(node as SemanticTemporalNode)

    return node as SemanticTemporalNode
  }

  /**
   * Adiciona aresta temporal com dados semânticos
   */
  async addTemporalEdge(
    from: string | NodeData,
    to: string | NodeData,
    activated_at: number,
    data?: EdgeData,
    deactivated_at?: number
  ): Promise<SemanticTemporalEdge> {
    // Gera embedding se não existir e provider estiver configurado
    if (data?.text && !data.embedding && this.embeddingProvider) {
      data.embedding = await this.embeddingProvider.embed(data.text)
    }

    return this.graph.addTemporalEdge(from, to, activated_at, data, deactivated_at) as SemanticTemporalEdge
  }

  /**
   * Busca semântica
   */
  async search(options: SemanticSearchOptions): Promise<SemanticSearchResult[]> {
    if (!this.embeddingProvider && (options.searchType === 'vector' || options.searchType === 'similarity' || options.searchType === 'hybrid')) {
      throw new Error('Embedding provider must be configured for vector/similarity/hybrid search')
    }

    const nodes = this.graph.getAllNodes() as SemanticTemporalNode[]

    switch (options.searchType) {
      case 'similarity':
        return searchBySimilarity(
          options.query,
          nodes,
          this.embeddingProvider!,
          options.threshold || 0.7,
          options.limit || 10
        )

      case 'fuzzy':
        return searchFuzzy(
          options.query,
          nodes,
          options.threshold || 0.6,
          options.limit || 10
        )

      case 'soundex':
        return searchSoundex(
          options.query,
          nodes,
          options.limit || 10
        )

      case 'index':
        return searchByIndex(options.query, this.index)

      case 'vector':
        if (!options.fields || options.fields.length === 0) {
          throw new Error('Vector search requires fields to be specified')
        }
        const vectorConfig: VectorSearchConfig = {
          fields: options.fields,
          threshold: options.threshold || 0.7,
          useFallback: options.useFallback || false,
          onBelowThreshold: options.useFallback
            ? (results) => results.slice(0, options.limit || 10)
            : undefined
        }
        return searchVector(options.query, nodes, this.embeddingProvider!, vectorConfig)

      case 'hybrid':
        return searchHybrid(options.query, nodes, this.embeddingProvider!, options)

      default:
        // Default para busca híbrida
        return searchHybrid(options.query, nodes, this.embeddingProvider!, options)
    }
  }

  /**
   * Gera embedding para um texto usando o provider configurado
   */
  async embed(text: string): Promise<number[]> {
    if (!this.embeddingProvider) {
      throw new Error('Embedding provider not configured')
    }
    return this.embeddingProvider.embed(text)
  }

  /**
   * Gera completão usando LLM
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured')
    }
    return this.llmProvider.complete(prompt, { systemPrompt })
  }

  /**
   * Stream de completão usando LLM
   */
  async *stream(prompt: string, systemPrompt?: string): AsyncIterable<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured')
    }
    yield* this.llmProvider.stream(prompt, { systemPrompt })
  }

  /**
   * Acessa o grafo temporal subjacente
   */
  getGraph(): TemporalGraph<NodeData, EdgeData> {
    return this.graph
  }

  /**
   * Reconstrui o índice invertido
   */
  rebuildIndex(): void {
    this.index.rebuild()
  }
}

