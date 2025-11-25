/**
 * Métricas e análises para conversas de atendimento e vendas
 */

import { ConversationData, ConversationMessage, ConversationMetrics, ConversationInsights } from '../types'
import { LLMProvider } from '../providers/llm'

/**
 * Calcula métricas de uma conversa
 */
export function calculateConversationMetrics(conversation: ConversationData): ConversationMetrics {
  const messages = conversation.messages
  const userMessages = messages.filter(m => m.type === 'user')
  const agentMessages = messages.filter(m => m.type === 'agent')

  // Calcula tempos de resposta
  const responseTimes: number[] = []
  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i]
    const next = messages[i + 1]

    // Se mensagem atual é do usuário e próxima é do agente
    if (current.type === 'user' && next.type === 'agent') {
      responseTimes.push(next.timestamp - current.timestamp)
    }
  }

  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0

  // Duração total
  const duration = conversation.metadata?.endedAt && conversation.metadata?.startedAt
    ? conversation.metadata.endedAt - conversation.metadata.startedAt
    : messages.length > 0
      ? messages[messages.length - 1].timestamp - messages[0].timestamp
      : 0

  return {
    duration,
    messageCount: messages.length,
    userMessageCount: userMessages.length,
    agentMessageCount: agentMessages.length,
    averageResponseTime,
    resolutionRate: conversation.metadata?.tags?.includes('resolved') ? 1.0 : undefined,
    sentiment: undefined, // Será calculado por análise de sentimento
    satisfactionScore: undefined // Será calculado por análise de sentimento
  }
}

/**
 * Analisa sentimento de uma mensagem usando LLM
 */
export async function analyzeSentiment(
  message: string,
  llmProvider: LLMProvider
): Promise<'positive' | 'neutral' | 'negative'> {
  const prompt = `Analise o sentimento da seguinte mensagem e responda apenas com "positive", "neutral" ou "negative":

"${message}"

Sentimento:`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um analisador de sentimento. Responda apenas com uma palavra: positive, neutral ou negative.' })
  
  const sentiment = response.toLowerCase().trim()
  if (sentiment.includes('positive')) return 'positive'
  if (sentiment.includes('negative')) return 'negative'
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
 * Calcula score de satisfação usando LLM
 */
export async function calculateSatisfactionScore(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<number> {
  const allText = conversation.messages
    .map(m => `${m.type}: ${m.content}`)
    .join('\n')

  const prompt = `Analise a seguinte conversa de atendimento e atribua um score de satisfação de 0 a 100, onde:
- 0-30: Muito insatisfeito
- 31-60: Insatisfeito
- 61-70: Neutro
- 71-85: Satisfeito
- 86-100: Muito satisfeito

Conversa:
${allText}

Score (apenas o número de 0 a 100):`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um analisador de satisfação. Responda apenas com um número de 0 a 100.' })
  
  const score = parseInt(response.trim(), 10)
  return isNaN(score) ? 50 : Math.max(0, Math.min(100, score))
}

/**
 * Extrai tópicos principais da conversa usando LLM
 */
export async function extractTopics(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique os principais tópicos discutidos na seguinte conversa. Liste apenas os tópicos, um por linha, sem numeração:

${allText}

Tópicos:`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um extrator de tópicos. Liste apenas os tópicos principais, um por linha.' })
  
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/))
}

/**
 * Detecta intenções na conversa usando LLM
 */
export async function detectIntents(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .filter(m => m.type === 'user')
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique as intenções do cliente na seguinte conversa. Intenções comuns incluem: fazer pedido, reclamar, solicitar informação, cancelar, elogiar, etc. Liste apenas as intenções, uma por linha:

${allText}

Intenções:`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um detector de intenções. Liste apenas as intenções identificadas, uma por linha.' })
  
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/))
}

/**
 * Identifica entidades mencionadas usando LLM
 */
export async function extractEntities(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<Array<{ type: string; value: string; confidence: number }>> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Extraia entidades mencionadas na seguinte conversa. Formate como JSON array com objetos contendo "type" (tipo da entidade como: produto, preço, data, pessoa, empresa, etc.), "value" (valor da entidade) e "confidence" (0.0 a 1.0):

${allText}

JSON:`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um extrator de entidades. Responda apenas com JSON válido.' })
  
  try {
    const entities = JSON.parse(response)
    return Array.isArray(entities) ? entities : []
  } catch {
    return []
  }
}

/**
 * Identifica pontos de dor do cliente usando LLM
 */
export async function identifyPainPoints(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique os pontos de dor ou problemas mencionados pelo cliente na seguinte conversa. Liste apenas os problemas, um por linha:

${allText}

Pontos de dor:`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um analista de experiência do cliente. Liste apenas os problemas identificados, um por linha.' })
  
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/))
}

/**
 * Identifica oportunidades de venda usando LLM
 */
export async function identifySalesOpportunities(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Identifique oportunidades de venda ou upsell na seguinte conversa. Liste apenas as oportunidades, uma por linha:

${allText}

Oportunidades:`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um analista de vendas. Liste apenas as oportunidades identificadas, uma por linha.' })
  
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/))
}

/**
 * Gera recomendações de ação usando LLM
 */
export async function generateRecommendations(
  conversation: ConversationData,
  llmProvider: LLMProvider
): Promise<string[]> {
  const metrics = calculateConversationMetrics(conversation)
  const allText = conversation.messages
    .map(m => m.content)
    .join('\n')

  const prompt = `Com base na seguinte conversa e métricas, gere recomendações de ação para melhorar o atendimento ou aproveitar oportunidades:

Métricas:
- Duração: ${metrics.duration}ms
- Mensagens: ${metrics.messageCount}
- Tempo médio de resposta: ${metrics.averageResponseTime}ms

Conversa:
${allText}

Recomendações:`

  const response = await llmProvider.complete(prompt, { systemPrompt: 'Você é um consultor de atendimento ao cliente. Liste apenas as recomendações, uma por linha.' })
  
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/))
}

/**
 * Gera insights completos de uma conversa
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

