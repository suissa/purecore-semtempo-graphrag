/**
 * Tipos e interfaces para o módulo semântico do grafo temporal
 */

import { TemporalGraph, TemporalNode, TemporalEdge } from '../temporalGraph'

/**
 * Configuração de provedor de embeddings
 */
export interface EmbeddingProviderConfig {
  /** Tipo do provedor */
  type: 'openai' | 'openrouter' | 'custom'
  /** API Key do provedor */
  apiKey: string
  /** URL base da API (opcional, para custom) */
  baseURL?: string
  /** Modelo a ser usado */
  model: string
  /** Dimensão dos embeddings */
  dimensions?: number
  /** Headers customizados */
  headers?: Record<string, string>
}

/**
 * Configuração de LLM
 */
export interface LLMProviderConfig {
  /** Tipo do provedor */
  type: 'openai' | 'openrouter' | 'custom'
  /** API Key do provedor */
  apiKey: string
  /** URL base da API (opcional, para custom) */
  baseURL?: string
  /** Modelo a ser usado */
  model: string
  /** Temperatura (0-2) */
  temperature?: number
  /** Max tokens */
  maxTokens?: number
  /** Headers customizados */
  headers?: Record<string, string>
}

/**
 * Dados semânticos de um nó
 */
export interface SemanticNodeData {
  /** Texto do nó para embedding */
  text: string
  /** Campos adicionais para busca vetorial */
  fields?: Record<string, string | number | boolean>
  /** Embedding vetorial (opcional, calculado automaticamente) */
  embedding?: number[]
  /** Metadados adicionais */
  metadata?: Record<string, any>
}

/**
 * Dados semânticos de uma aresta
 */
export interface SemanticEdgeData {
  /** Texto da aresta para embedding */
  text?: string
  /** Campos adicionais para busca vetorial */
  fields?: Record<string, string | number | boolean>
  /** Embedding vetorial (opcional) */
  embedding?: number[]
  /** Metadados adicionais */
  metadata?: Record<string, any>
}

/**
 * Nó temporal com dados semânticos
 */
export type SemanticTemporalNode = TemporalNode<SemanticNodeData>

/**
 * Aresta temporal com dados semânticos
 */
export type SemanticTemporalEdge = TemporalEdge<SemanticEdgeData>

/**
 * Opções de busca semântica
 */
export interface SemanticSearchOptions {
  /** Query de busca */
  query: string
  /** Campos a serem buscados (para busca vetorial) */
  fields?: string[]
  /** Threshold de similaridade (0-1) */
  threshold?: number
  /** Usar fallback se resultados abaixo do threshold */
  useFallback?: boolean
  /** Limite de resultados */
  limit?: number
  /** Tipo de busca */
  searchType?: 'similarity' | 'hybrid' | 'index' | 'fuzzy' | 'soundex' | 'vector'
}

/**
 * Resultado de busca semântica
 */
export interface SemanticSearchResult {
  /** Nó encontrado */
  node: SemanticTemporalNode
  /** Score de similaridade/relevância */
  score: number
  /** Tipo de match */
  matchType: 'exact' | 'similar' | 'fuzzy' | 'soundex' | 'vector' | 'hybrid'
  /** Campos que fizeram match */
  matchedFields?: string[]
}

/**
 * Configuração de busca vetorial
 */
export interface VectorSearchConfig {
  /** Campos a serem indexados para busca vetorial */
  fields: string[]
  /** Threshold mínimo de similaridade */
  threshold: number
  /** Usar fallback para resultados abaixo do threshold */
  useFallback: boolean
  /** Callback para processar resultados abaixo do threshold */
  onBelowThreshold?: (results: SemanticSearchResult[]) => SemanticSearchResult[]
}

/**
 * Dados de uma conversa
 */
export interface ConversationData {
  /** ID da conversa */
  conversationId: string
  /** Mensagens da conversa */
  messages: ConversationMessage[]
  /** Metadados da conversa */
  metadata?: {
    customerId?: string
    agentId?: string
    channel?: string
    startedAt?: number
    endedAt?: number
    tags?: string[]
  }
}

/**
 * Mensagem de conversa
 */
export interface ConversationMessage {
  /** ID da mensagem */
  messageId: string
  /** Tipo de mensagem */
  type: 'user' | 'agent' | 'system'
  /** Conteúdo da mensagem */
  content: string
  /** Timestamp da mensagem */
  timestamp: number
  /** Metadados da mensagem */
  metadata?: Record<string, any>
}

/**
 * Métricas de conversa
 */
export interface ConversationMetrics {
  /** Duração total da conversa (ms) */
  duration: number
  /** Número de mensagens */
  messageCount: number
  /** Número de mensagens do usuário */
  userMessageCount: number
  /** Número de mensagens do agente */
  agentMessageCount: number
  /** Tempo médio de resposta do agente (ms) */
  averageResponseTime: number
  /** Taxa de resolução (se aplicável) */
  resolutionRate?: number
  /** Sentimento geral */
  sentiment?: 'positive' | 'neutral' | 'negative'
  /** Score de satisfação (0-100) */
  satisfactionScore?: number
}

/**
 * Insights de conversa
 */
export interface ConversationInsights {
  /** Tópicos principais identificados */
  topics: string[]
  /** Intenções detectadas */
  intents: string[]
  /** Entidades mencionadas */
  entities: Array<{ type: string; value: string; confidence: number }>
  /** Pontos de dor identificados */
  painPoints?: string[]
  /** Oportunidades de venda identificadas */
  salesOpportunities?: string[]
  /** Recomendações de ação */
  recommendations?: string[]
}

