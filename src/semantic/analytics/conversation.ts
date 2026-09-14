/**
 * Métricas e análises para conversas de atendimento e vendas
 */

import {
  ConversationData,
  ConversationMessage,
  ConversationMetrics,
  ConversationInsights
} from '../types'
import { LLMProvider } from '../providers/llm'

/**
 * Utilitário para contar palavras em um texto
 */
function countWords(text: string): number {
  if (!text) return 0
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Calcula mediana de uma lista de números
 */
function calculateMedian(numbers: number[]): number | undefined {
  if (numbers.length === 0) return undefined
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 !== 0) {
    return sorted[mid]
  }
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Extrai e faz o parse resiliente de JSON de uma resposta de LLM,
 * suportando blocos de código ```json ... ``` ou JSON puro.
 */
export function extractJSON<T = any>(text: string): T | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()

  // 1. Tenta parse direto
  try {
    return JSON.parse(trimmed) as T
  } catch {}

  // 2. Procura bloco de código ```json ... ``` ou ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T
    } catch {}
  }

  // 3. Procura o primeiro objeto { ... }
  const firstCurly = trimmed.indexOf('{')
  const lastCurly = trimmed.lastIndexOf('}')
  if (firstCurly !== -1 && lastCurly > firstCurly) {
    try {
      return JSON.parse(trimmed.slice(firstCurly, lastCurly + 1)) as T
    } catch {}
  }

  // 4. Procura o primeiro array [ ... ]
  const firstBracket = trimmed.indexOf('[')
  const lastBracket = trimmed.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1)) as T
    } catch {}
  }

  return null
}

/**
 * Calcula métricas determinísticas e temporais completas de uma conversa.
 */
export function calculateConversationMetrics(conversation: ConversationData): ConversationMetrics {
  const messages = conversation.messages || []
  const userMessages = messages.filter(m => m.type === 'user')
  const agentMessages = messages.filter(m => m.type === 'agent')
  const systemMessages = messages.filter(m => m.type === 'system')

  // Tempos de resposta do agente (usuário -> agente)
  const agentResponseTimes: number[] = []
  // Tempos de réplica do usuário (agente -> usuário)
  const userResponseTimes: number[] = []
  let silenceDuration = 0
  let turnCount = 0

  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i]
    const next = messages[i + 1]
    const diff = Math.max(0, next.timestamp - current.timestamp)

    if (diff > silenceDuration) {
      silenceDuration = diff
    }

    if (current.type !== next.type) {
      turnCount++
    }

    if (current.type === 'user' && next.type === 'agent') {
      agentResponseTimes.push(diff)
    } else if (current.type === 'agent' && next.type === 'user') {
      userResponseTimes.push(diff)
    }
  }

  const averageResponseTime = agentResponseTimes.length > 0
    ? agentResponseTimes.reduce((a, b) => a + b, 0) / agentResponseTimes.length
    : 0

  const minResponseTime = agentResponseTimes.length > 0
    ? Math.min(...agentResponseTimes)
    : undefined

  const maxResponseTime = agentResponseTimes.length > 0
    ? Math.max(...agentResponseTimes)
    : undefined

  const medianResponseTime = calculateMedian(agentResponseTimes)

  // TTFR (Time to First Response): primeiro user até primeiro agent
  let firstResponseTime: number | undefined = undefined
  const firstUserMsg = messages.find(m => m.type === 'user')
  const firstAgentMsg = messages.find(m => m.type === 'agent')
  if (firstUserMsg && firstAgentMsg && firstAgentMsg.timestamp >= firstUserMsg.timestamp) {
    firstResponseTime = firstAgentMsg.timestamp - firstUserMsg.timestamp
  }

  const averageUserResponseTime = userResponseTimes.length > 0
    ? userResponseTimes.reduce((a, b) => a + b, 0) / userResponseTimes.length
    : undefined

  // Duração total
  const duration = conversation.metadata?.endedAt && conversation.metadata?.startedAt
    ? Math.max(0, conversation.metadata.endedAt - conversation.metadata.startedAt)
    : messages.length > 1
      ? Math.max(0, messages[messages.length - 1].timestamp - messages[0].timestamp)
      : 0

  // Contagem de palavras e caracteres
  let totalChars = 0
  let totalWordCount = 0
  let userWordCount = 0
  let agentWordCount = 0
  let questionCount = 0
  let userQuestionCount = 0
  let agentQuestionCount = 0

  for (const m of messages) {
    const content = m.content || ''
    totalChars += content.length
    const words = countWords(content)
    totalWordCount += words

    const hasQuestion = content.includes('?')
    if (hasQuestion) questionCount++

    if (m.type === 'user') {
      userWordCount += words
      if (hasQuestion) userQuestionCount++
    } else if (m.type === 'agent') {
      agentWordCount += words
      if (hasQuestion) agentQuestionCount++
    }
  }

  const messageCount = messages.length
  const userMessageCount = userMessages.length
  const agentMessageCount = agentMessages.length
  const systemMessageCount = systemMessages.length

  const userMessageRatio = messageCount > 0 ? userMessageCount / messageCount : 0
  const agentMessageRatio = messageCount > 0 ? agentMessageCount / messageCount : 0
  const averageMessageLength = messageCount > 0 ? totalChars / messageCount : 0
  const averageWordsPerMessage = messageCount > 0 ? totalWordCount / messageCount : 0

  const durationMinutes = duration / 60_000
  const messagesPerMinute = durationMinutes > 0 ? messageCount / durationMinutes : 0

  const firstMessageType = messageCount > 0 ? messages[0].type : undefined
  const lastMessageType = messageCount > 0 ? messages[messageCount - 1].type : undefined

  return {
    duration,
    messageCount,
    userMessageCount,
    agentMessageCount,
    systemMessageCount,
    userMessageRatio,
    agentMessageRatio,
    averageResponseTime,
    minResponseTime,
    maxResponseTime,
    medianResponseTime,
    firstResponseTime,
    averageUserResponseTime,
    turnCount,
    isMultiTurn: turnCount > 1,
    silenceDuration,
    totalWordCount,
    userWordCount,
    agentWordCount,
    averageMessageLength,
    averageWordsPerMessage,
    questionCount,
    userQuestionCount,
    agentQuestionCount,
    firstMessageType,
    lastMessageType,
    messagesPerMinute,
    resolutionRate: conversation.metadata?.tags?.includes('resolved') ? 1.0 : undefined,
    sentiment: undefined,
    satisfactionScore: undefined
  }
}

/**
 * Analisa sentimento de uma mensagem usando LLM com Schema JSON e validação estrita.
 */
export async function analyzeSentiment(
  message: string,
  llmProvider: LLMProvider
): Promise<'positive' | 'neutral' | 'negative'> {
  const prompt = `Analise o sentimento da mensagem a seguir.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": string
}

Mensagem:
"${message}"`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um analisador de sentimento rigoroso. Retorne apenas JSON com o schema solicitado.'
  })

  interface SentimentResult {
    sentiment?: string
    confidence?: number
  }

  const parsed = extractJSON<SentimentResult>(response)
  if (parsed?.sentiment) {
    const s = parsed.sentiment.toLowerCase().trim()
    if (s === 'positive' || s === 'neutral' || s === 'negative') {
      return s
    }
  }

  // Fallback heurístico em caso de JSON com valor inesperado
  const lower = response.toLowerCase()
  if (lower.includes('positive')) return 'positive'
  if (lower.includes('negative')) return 'negative'
  return 'neutral'
}

/**
 * Analisa sentimento geral da conversa
 */
export async function analyzeConversationSentiment(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<'positive' | 'neutral' | 'negative'> {
  const allText = conversation.messages
    .map(m => `${m.type}: ${m.content}`)
    .join('\n')

  return analyzeSentiment(allText, llmProvider)
}

/**
 * Calcula score de satisfação (0-100) usando LLM com Schema JSON e validação.
 */
export async function calculateSatisfactionScore(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<number> {
  const allText = conversation.messages
    .map(m => `${m.type}: ${m.content}`)
    .join('\n')

  const prompt = `Analise a seguinte conversa de atendimento e determine um score de satisfação de 0 a 100:
- 0-30: Muito insatisfeito
- 31-60: Insatisfeito
- 61-70: Neutro
- 71-85: Satisfeito
- 86-100: Muito satisfeito

Responda ESTRITAMENTE em JSON com o seguinte schema:
{
  "score": number,
  "reason": string
}

Conversa:
${allText}`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um avaliador de satisfação de atendimento. Retorne apenas JSON válido.'
  })

  interface ScoreResult {
    score?: number
  }

  const parsed = extractJSON<ScoreResult>(response)
  if (parsed && typeof parsed.score === 'number' && !isNaN(parsed.score)) {
    return Math.max(0, Math.min(100, Math.round(parsed.score)))
  }

  // Fallback numérico regex
  const match = response.match(/\b([0-9]{1,3})\b/)
  if (match) {
    const num = parseInt(match[1], 10)
    if (!isNaN(num) && num <= 100) {
      return Math.max(0, Math.min(100, num))
    }
  }

  return 50
}

/**
 * Extrai tópicos principais da conversa usando LLM com Schema JSON e validação.
 */
export async function extractTopics(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique os principais tópicos discutidos na seguinte conversa.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "topics": string[]
}

Conversa:
${allText}`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um extrator de tópicos. Responda apenas com o JSON requerido.'
  })

  interface TopicsResult {
    topics?: any[]
  }

  const parsed = extractJSON<TopicsResult | any[]>(response)
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.topics)
      ? parsed.topics
      : null

  if (rawList) {
    return rawList
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }

  // Fallback para divisão por linhas
  return response
    .split('\n')
    .map(line => line.trim().replace(/^[-*•\d\.\)\s]+/, ''))
    .filter(line => line.length > 0 && !line.startsWith('{') && !line.startsWith('}'))
}

/**
 * Detecta intenções na conversa usando LLM com Schema JSON e validação.
 */
export async function detectIntents(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .filter(m => m.type === 'user')
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique as intenções do usuário na seguinte conversa (ex.: fazer pedido, reclamar, tirar dúvida, cancelar, elogiar, etc.).
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "intents": string[]
}

Mensagens do Usuário:
${allText}`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um detector de intenções. Responda apenas com o JSON requerido.'
  })

  interface IntentsResult {
    intents?: any[]
  }

  const parsed = extractJSON<IntentsResult | any[]>(response)
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.intents)
      ? parsed.intents
      : null

  if (rawList) {
    return rawList
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }

  return response
    .split('\n')
    .map(line => line.trim().replace(/^[-*•\d\.\)\s]+/, ''))
    .filter(line => line.length > 0 && !line.startsWith('{') && !line.startsWith('}'))
}

/**
 * Identifica entidades mencionadas usando LLM com Schema JSON e validação estrita.
 */
export async function extractEntities(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<Array<{ type: string; value: string; confidence: number }>> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Extraia entidades mencionadas na seguinte conversa.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "entities": [
    {
      "type": string,
      "value": string,
      "confidence": number
    }
  ]
}

Conversa:
${allText}`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um extrator de entidades de alta precisão. Responda apenas com o JSON requerido.'
  })

  interface EntitiesResult {
    entities?: any[]
  }

  const parsed = extractJSON<EntitiesResult | any[]>(response)
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.entities)
      ? parsed.entities
      : null

  if (!rawList) return []

  const validEntities: Array<{ type: string; value: string; confidence: number }> = []

  for (const item of rawList) {
    if (
      item &&
      typeof item.type === 'string' &&
      typeof item.value === 'string' &&
      item.type.trim() &&
      item.value.trim()
    ) {
      const conf = typeof item.confidence === 'number' && !isNaN(item.confidence)
        ? Math.max(0, Math.min(1, item.confidence))
        : 1.0
      validEntities.push({
        type: item.type.trim(),
        value: item.value.trim(),
        confidence: conf
      })
    }
  }

  return validEntities
}

/**
 * Identifica pontos de dor do cliente usando LLM com Schema JSON e validação.
 */
export async function identifyPainPoints(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique os pontos de dor ou problemas relatados pelo cliente na conversa.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "painPoints": string[]
}

Conversa:
${allText}`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um especialista em experiência do cliente. Responda apenas com o JSON requerido.'
  })

  interface PainPointsResult {
    painPoints?: any[]
  }

  const parsed = extractJSON<PainPointsResult | any[]>(response)
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.painPoints)
      ? parsed.painPoints
      : null

  if (rawList) {
    return rawList
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }

  return response
    .split('\n')
    .map(line => line.trim().replace(/^[-*•\d\.\)\s]+/, ''))
    .filter(line => line.length > 0 && !line.startsWith('{') && !line.startsWith('}'))
}

/**
 * Identifica oportunidades de venda usando LLM com Schema JSON e validação.
 */
export async function identifySalesOpportunities(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique oportunidades de venda, upsell ou cross-sell na seguinte conversa.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "opportunities": string[]
}

Conversa:
${allText}`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um analista de vendas experiente. Responda apenas com o JSON requerido.'
  })

  interface OpportunitiesResult {
    opportunities?: any[]
  }

  const parsed = extractJSON<OpportunitiesResult | any[]>(response)
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.opportunities)
      ? parsed.opportunities
      : null

  if (rawList) {
    return rawList
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }

  return response
    .split('\n')
    .map(line => line.trim().replace(/^[-*•\d\.\)\s]+/, ''))
    .filter(line => line.length > 0 && !line.startsWith('{') && !line.startsWith('}'))
}

/**
 * Gera recomendações de ação usando LLM com Schema JSON e validação.
 */
export async function generateRecommendations(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const metrics = calculateConversationMetrics(conversation)
  const allText = conversation.messages
    .map(m => `${m.type}: ${m.content}`)
    .join('\n')

  const prompt = `Com base nas métricas e na conversa a seguir, gere recomendações acionáveis para otimizar o atendimento ou fechar negócios.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "recommendations": string[]
}

Métricas:
- Duração: ${metrics.duration}ms
- Total de mensagens: ${metrics.messageCount} (User: ${metrics.userMessageCount}, Agent: ${metrics.agentMessageCount})
- Tempo médio de resposta: ${metrics.averageResponseTime}ms

Conversa:
${allText}`

  const response = await llmProvider.complete(prompt, {
    jsonMode: true,
    systemPrompt: 'Você é um consultor sênior de atendimento e vendas. Responda apenas com o JSON requerido.'
  })

  interface RecommendationsResult {
    recommendations?: any[]
  }

  const parsed = extractJSON<RecommendationsResult | any[]>(response)
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
      : null

  if (rawList) {
    return rawList
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }

  return response
    .split('\n')
    .map(line => line.trim().replace(/^[-*•\d\.\)\s]+/, ''))
    .filter(line => line.length > 0 && !line.startsWith('{') && !line.startsWith('}'))
}

/**
 * Gera insights completos de uma conversa de forma paralela e estruturada.
 */
export async function generateConversationInsights(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<ConversationInsights> {
  const [topics, intents, entities, painPoints, opportunities, recommendations] = await Promise.all([
    extractTopics(conversation, llmProvider),
    detectIntents(conversation, llmProvider),
    extractEntities(conversation, llmProvider),
    identifyPainPoints(conversation, llmProvider),
    identifySalesOpportunities(conversation, llmProvider),
    generateRecommendations(conversation, llmProvider)
  ])

  return {
    topics,
    intents,
    entities,
    painPoints,
    salesOpportunities: opportunities,
    recommendations
  }
}


