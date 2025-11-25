/**
 * Provedores de LLM
 */

import { LLMProviderConfig } from '../types'

/**
 * Interface para provedor de LLM
 */
export interface LLMProvider {
  /** Gera completão de texto */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<string>
  /** Gera completão com streaming */
  stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string>
}

/**
 * Opções de completão de LLM
 */
export interface LLMCompletionOptions {
  /** Temperatura (0-2) */
  temperature?: number
  /** Max tokens */
  maxTokens?: number
  /** System prompt */
  systemPrompt?: string
  /** Stop sequences */
  stop?: string[]
}

/**
 * Provedor de LLM da OpenAI
 */
export class OpenAILLMProvider implements LLMProvider {
  private config: LLMProviderConfig

  constructor(config: LLMProviderConfig) {
    this.config = config
  }

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = []
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    
    messages.push({ role: 'user', content: prompt })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        stop: options?.stop
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0].message.content
  }

  async *stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string> {
    const messages: Array<{ role: string; content: string }> = []
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    
    messages.push({ role: 'user', content: prompt })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        stop: options?.stop,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return
          
          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

/**
 * Provedor de LLM do OpenRouter
 */
export class OpenRouterLLMProvider implements LLMProvider {
  private config: LLMProviderConfig

  constructor(config: LLMProviderConfig) {
    this.config = config
  }

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
    const baseURL = this.config.baseURL || 'https://openrouter.ai/api/v1'
    const messages: Array<{ role: string; content: string }> = []
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(`${baseURL}/chat/completions`, {
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
        messages,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        stop: options?.stop
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0].message.content
  }

  async *stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string> {
    const baseURL = this.config.baseURL || 'https://openrouter.ai/api/v1'
    const messages: Array<{ role: string; content: string }> = []
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(`${baseURL}/chat/completions`, {
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
        messages,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        stop: options?.stop,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return
          
          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

/**
 * Factory para criar provedores de LLM
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAILLMProvider(config)
    case 'openrouter':
      return new OpenRouterLLMProvider(config)
    case 'custom':
      if (!config.baseURL) {
        throw new Error('Custom provider requires baseURL')
      }
      return new OpenRouterLLMProvider(config)
    default:
      throw new Error(`Unsupported LLM provider type: ${config.type}`)
  }
}

