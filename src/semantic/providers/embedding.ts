/**
 * Provedores de embeddings
 */

import { EmbeddingProviderConfig } from '../types'

/**
 * Interface para provedor de embeddings
 */
export interface EmbeddingProvider {
  /** Gera embedding para um texto */
  embed(text: string): Promise<number[]>
  /** Gera embeddings para múltiplos textos */
  embedBatch(texts: string[]): Promise<number[][]>
  /** Retorna a dimensão dos embeddings */
  getDimensions(): number
}

/**
 * Provedor de embeddings da OpenAI
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingProviderConfig
  private dimensions: number

  constructor(config: EmbeddingProviderConfig) {
    this.config = config
    this.dimensions = config.dimensions || 1536 // text-embedding-ada-002 default
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> }
    return data.data.map((item) => item.embedding)
  }

  getDimensions(): number {
    return this.dimensions
  }
}

/**
 * Provedor de embeddings do OpenRouter
 */
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingProviderConfig
  private dimensions: number

  constructor(config: EmbeddingProviderConfig) {
    this.config = config
    this.dimensions = config.dimensions || 1536
  }

  async embed(text: string): Promise<number[]> {
    const baseURL = this.config.baseURL || 'https://openrouter.ai/api/v1'
    const response = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://github.com/suissa/typescript-temporal-graph',
        'X-Title': 'SemTempo Graph',
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const baseURL = this.config.baseURL || 'https://openrouter.ai/api/v1'
    const response = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://github.com/suissa/typescript-temporal-graph',
        'X-Title': 'SemTempo Graph',
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> }
    return data.data.map((item) => item.embedding)
  }

  getDimensions(): number {
    return this.dimensions
  }
}

/**
 * Factory para criar provedores de embeddings
 */
export function createEmbeddingProvider(config: EmbeddingProviderConfig): EmbeddingProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIEmbeddingProvider(config)
    case 'openrouter':
      return new OpenRouterEmbeddingProvider(config)
    case 'custom':
      if (!config.baseURL) {
        throw new Error('Custom provider requires baseURL')
      }
      // Para custom, você pode implementar seu próprio provider
      // Por enquanto, usamos OpenRouter como base
      return new OpenRouterEmbeddingProvider(config)
    default:
      throw new Error(`Unsupported embedding provider type: ${config.type}`)
  }
}

