import {
  TemporalGraph,
  GraphQueryBuilder,
  GraphPruner,
  PruneEdgeOptions,
  CompressEdgeOptions,
  IGraphStorageAdapter
} from '@purecore/temporal-graph'

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
import { searchVector } from './search/vector'
import { searchHybrid } from './search/hybrid'

export class SemanticTemporalGraph<
  NodeData extends SemanticNodeData = SemanticNodeData,
  EdgeData extends SemanticEdgeData = SemanticEdgeData
> {
  private graph: TemporalGraph<NodeData, EdgeData>
  private embeddingProvider?: EmbeddingProvider
  private llmProvider?: LLMProvider
  private pruner: GraphPruner<NodeData, EdgeData>
  private storageAdapter?: IGraphStorageAdapter<NodeData, EdgeData>

  constructor(identityFn: (data: NodeData) => string) {
    this.graph = new TemporalGraph<NodeData, EdgeData>(identityFn)
    this.pruner = new GraphPruner<NodeData, EdgeData>(this.graph)
  }

  query(): GraphQueryBuilder<NodeData, EdgeData> {
    return new GraphQueryBuilder<NodeData, EdgeData>(this, this.pruner)
  }

  attachStorage(storage: IGraphStorageAdapter<NodeData, EdgeData>): void {
    this.storageAdapter = storage
  }

  async syncStorage(): Promise<void> {
    if (!this.storageAdapter) throw new Error('Storage adapter not attached')
    await this.storageAdapter.syncGraph(this.graph.getAllNodes(), this.graph.getAllEdges())
  }

  getPruner(): GraphPruner<NodeData, EdgeData> {
    return this.pruner
  }

  prune(options?: PruneEdgeOptions) {
    return this.pruner.pruneEdges(options)
  }

  compress(options?: CompressEdgeOptions<EdgeData>) {
    return this.pruner.compressTransientEdges(options)
  }

  setEmbeddingProvider(config: EmbeddingProviderConfig): void {
    this.embeddingProvider = createEmbeddingProvider(config)
  }

  setLLMProvider(config: LLMProviderConfig): void {
    this.llmProvider = createLLMProvider(config)
  }

  async insertNode(data: NodeData): Promise<SemanticTemporalNode> {
    if (!data.embedding && this.embeddingProvider) {
      data.embedding = await this.embeddingProvider.embed(data.text)
    }

    const node = this.graph.insertNode(data)
    return node as SemanticTemporalNode
  }

  async addTemporalEdge(
    from: string | NodeData,
    to: string | NodeData,
    activated_at: number,
    data?: EdgeData,
    deactivated_at?: number
  ): Promise<SemanticTemporalEdge> {
    if (data?.text && !data.embedding && this.embeddingProvider) {
      data.embedding = await this.embeddingProvider.embed(data.text)
    }

    return this.graph.addTemporalEdge(from, to, activated_at, data, deactivated_at) as SemanticTemporalEdge
  }

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
      default:
        return searchHybrid(options.query, nodes, this.embeddingProvider!, options)
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.embeddingProvider) {
      throw new Error('Embedding provider not configured')
    }
    return this.embeddingProvider.embed(text)
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured')
    }
    return this.llmProvider.complete(prompt, { systemPrompt })
  }

  async *stream(prompt: string, systemPrompt?: string): AsyncIterable<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured')
    }
    yield* this.llmProvider.stream(prompt, { systemPrompt })
  }

  getGraph(): TemporalGraph<NodeData, EdgeData> {
    return this.graph
  }
}
