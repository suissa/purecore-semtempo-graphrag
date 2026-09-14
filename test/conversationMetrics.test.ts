import {
  calculateConversationMetrics,
  extractJSON,
  analyzeSentiment,
  analyzeConversationSentiment,
  calculateSatisfactionScore,
  extractTopics,
  detectIntents,
  extractEntities,
  identifyPainPoints,
  identifySalesOpportunities,
  generateRecommendations,
  generateConversationInsights
} from '../src/semantic/analytics/conversation'
import { ConversationData, ConversationMessage } from '../src/semantic/types'
import { LLMProvider, LLMCompletionOptions } from '../src/semantic/providers/llm'

describe('conversationMetrics', () => {
  describe('calculateConversationMetrics (deterministic features)', () => {
    it('should handle empty conversation gracefully', () => {
      const conv: ConversationData = {
        conversationId: 'c-empty',
        messages: []
      }

      const metrics = calculateConversationMetrics(conv)

      expect(metrics.duration).toBe(0)
      expect(metrics.messageCount).toBe(0)
      expect(metrics.userMessageCount).toBe(0)
      expect(metrics.agentMessageCount).toBe(0)
      expect(metrics.systemMessageCount).toBe(0)
      expect(metrics.userMessageRatio).toBe(0)
      expect(metrics.agentMessageRatio).toBe(0)
      expect(metrics.averageResponseTime).toBe(0)
      expect(metrics.minResponseTime).toBeUndefined()
      expect(metrics.maxResponseTime).toBeUndefined()
      expect(metrics.medianResponseTime).toBeUndefined()
      expect(metrics.firstResponseTime).toBeUndefined()
      expect(metrics.averageUserResponseTime).toBeUndefined()
      expect(metrics.silenceDuration).toBe(0)
      expect(metrics.turnCount).toBe(0)
      expect(metrics.isMultiTurn).toBe(false)
      expect(metrics.totalWordCount).toBe(0)
      expect(metrics.userWordCount).toBe(0)
      expect(metrics.agentWordCount).toBe(0)
      expect(metrics.averageMessageLength).toBe(0)
      expect(metrics.averageWordsPerMessage).toBe(0)
      expect(metrics.questionCount).toBe(0)
      expect(metrics.userQuestionCount).toBe(0)
      expect(metrics.agentQuestionCount).toBe(0)
      expect(metrics.firstMessageType).toBeUndefined()
      expect(metrics.lastMessageType).toBeUndefined()
      expect(metrics.messagesPerMinute).toBe(0)
      expect(metrics.resolutionRate).toBeUndefined()
    })

    it('should handle single message conversation', () => {
      const conv: ConversationData = {
        conversationId: 'c-single',
        messages: [
          {
            messageId: 'm1',
            type: 'user',
            content: 'Olá, preciso de ajuda com minha conta?',
            timestamp: 1000
          }
        ]
      }

      const metrics = calculateConversationMetrics(conv)

      expect(metrics.duration).toBe(0)
      expect(metrics.messageCount).toBe(1)
      expect(metrics.userMessageCount).toBe(1)
      expect(metrics.agentMessageCount).toBe(0)
      expect(metrics.userMessageRatio).toBe(1)
      expect(metrics.agentMessageRatio).toBe(0)
      expect(metrics.averageResponseTime).toBe(0)
      expect(metrics.minResponseTime).toBeUndefined()
      expect(metrics.firstResponseTime).toBeUndefined()
      expect(metrics.turnCount).toBe(0)
      expect(metrics.isMultiTurn).toBe(false)
      expect(metrics.totalWordCount).toBe(7)
      expect(metrics.userWordCount).toBe(7)
      expect(metrics.agentWordCount).toBe(0)
      expect(metrics.questionCount).toBe(1)
      expect(metrics.userQuestionCount).toBe(1)
      expect(metrics.agentQuestionCount).toBe(0)
      expect(metrics.firstMessageType).toBe('user')
      expect(metrics.lastMessageType).toBe('user')
    })

    it('should calculate complete metrics for realistic customer service conversation', () => {
      const messages: ConversationMessage[] = [
        {
          messageId: 'm1',
          type: 'user',
          content: 'Bom dia, gostaria de saber o status do meu pedido?',
          timestamp: 10000 // t = 10s
        },
        {
          messageId: 'm2',
          type: 'agent',
          content: 'Bom dia! Claro, qual é o número do seu pedido?',
          timestamp: 25000 // t = 25s (resposta em 15s)
        },
        {
          messageId: 'm3',
          type: 'user',
          content: 'É o pedido #98765.',
          timestamp: 40000 // t = 40s (usuário responde em 15s)
        },
        {
          messageId: 'm4',
          type: 'agent',
          content: 'Verifiquei aqui, seu pedido já foi enviado e chega amanhã!',
          timestamp: 45000 // t = 45s (agente responde em 5s)
        },
        {
          messageId: 'm5',
          type: 'user',
          content: 'Perfeito, muito obrigado!',
          timestamp: 60000 // t = 60s (usuário responde em 15s)
        },
        {
          messageId: 'm6',
          type: 'agent',
          content: 'Por nada! Posso ajudar em algo mais?',
          timestamp: 70000 // t = 70s (agente responde em 10s)
        }
      ]

      const conv: ConversationData = {
        conversationId: 'c-full',
        messages,
        metadata: {
          startedAt: 10000,
          endedAt: 70000,
          tags: ['resolved', 'shipping']
        }
      }

      const metrics = calculateConversationMetrics(conv)

      // Duração: 70000 - 10000 = 60000ms (1 minuto)
      expect(metrics.duration).toBe(60000)
      expect(metrics.messageCount).toBe(6)
      expect(metrics.userMessageCount).toBe(3)
      expect(metrics.agentMessageCount).toBe(3)
      expect(metrics.userMessageRatio).toBe(0.5)
      expect(metrics.agentMessageRatio).toBe(0.5)

      // Tempos de resposta do agente:
      // m1 (10s) -> m2 (25s) = 15s
      // m3 (40s) -> m4 (45s) = 5s
      // m5 (60s) -> m6 (70s) = 10s
      // Respostas: [15000, 5000, 10000]
      // Média = (15000 + 5000 + 10000) / 3 = 10000ms
      expect(metrics.averageResponseTime).toBe(10000)
      expect(metrics.minResponseTime).toBe(5000)
      expect(metrics.maxResponseTime).toBe(15000)
      expect(metrics.medianResponseTime).toBe(10000)

      // TTFR (Time to First Response): m2 (25s) - m1 (10s) = 15000ms
      expect(metrics.firstResponseTime).toBe(15000)

      // Tempos de réplica do usuário:
      // m2 (25s) -> m3 (40s) = 15000ms
      // m4 (45s) -> m5 (60s) = 15000ms
      // Média = 15000ms
      expect(metrics.averageUserResponseTime).toBe(15000)

      // Maior silêncio: max(15000, 15000, 5000, 15000, 10000) = 15000ms
      expect(metrics.silenceDuration).toBe(15000)

      // Turnos: m1(u)->m2(a)->m3(u)->m4(a)->m5(u)->m6(a) = 5 alternâncias
      expect(metrics.turnCount).toBe(5)
      expect(metrics.isMultiTurn).toBe(true)

      // Perguntas:
      // m1: "?" (user)
      // m2: "?" (agent)
      // m6: "?" (agent)
      expect(metrics.questionCount).toBe(3)
      expect(metrics.userQuestionCount).toBe(1)
      expect(metrics.agentQuestionCount).toBe(2)

      // Início e fim
      expect(metrics.firstMessageType).toBe('user')
      expect(metrics.lastMessageType).toBe('agent')

      // Mensagens por minuto: 6 mensagens / 1 min = 6 msgs/min
      expect(metrics.messagesPerMinute).toBeCloseTo(6, 1)

      // Resolução
      expect(metrics.resolutionRate).toBe(1.0)
    })
  })

  describe('extractJSON utility', () => {
    it('should parse direct JSON string', () => {
      const obj = extractJSON<{ key: string }>('{"key": "value"}')
      expect(obj).toEqual({ key: 'value' })
    })

    it('should parse JSON wrapped in markdown block', () => {
      const markdown = '```json\n{\n  "sentiment": "positive",\n  "confidence": 0.95\n}\n```'
      const obj = extractJSON<{ sentiment: string; confidence: number }>(markdown)
      expect(obj).toEqual({ sentiment: 'positive', confidence: 0.95 })
    })

    it('should parse JSON with surrounding conversational text', () => {
      const text = 'Aqui está a resposta:\n{"score": 92, "reason": "Excelente atendimento"}\nEspero ter ajudado!'
      const obj = extractJSON<{ score: number }>(text)
      expect(obj?.score).toBe(92)
    })

    it('should parse JSON array', () => {
      const text = '```json\n["entrega", "preço", "suporte"]\n```'
      const arr = extractJSON<string[]>(text)
      expect(arr).toEqual(['entrega', 'preço', 'suporte'])
    })

    it('should return null for invalid text', () => {
      expect(extractJSON('')).toBeNull()
      expect(extractJSON('apenas texto sem json')).toBeNull()
    })
  })

  describe('LLM analytics with JSON schema and validation', () => {
    // Mock simples de LLMProvider para testar respostas com JSON mode
    function createMockLLM(responseGenerator: (prompt: string, opts?: LLMCompletionOptions) => string): LLMProvider {
      return {
        async complete(prompt: string, options?: LLMCompletionOptions): Promise<string> {
          return responseGenerator(prompt, options)
        },
        async *stream(): AsyncIterable<string> {
          yield ''
        }
      }
    }

    it('should analyze sentiment with JSON schema validation', async () => {
      const mockLLM = createMockLLM((prompt, options) => {
        expect(options?.jsonMode).toBe(true)
        return '```json\n{"sentiment": "positive", "confidence": 0.95, "explanation": "Muito satisfeito"}\n```'
      })

      const sentiment = await analyzeSentiment('Adorei o produto, parabéns!', mockLLM)
      expect(sentiment).toBe('positive')
    })

    it('should fallback gracefully when sentiment JSON is invalid', async () => {
      const mockLLM = createMockLLM(() => 'O sentimento parece ser claramente negative.')
      const sentiment = await analyzeSentiment('Péssimo serviço', mockLLM)
      expect(sentiment).toBe('negative')
    })

    it('should calculate satisfaction score with JSON schema validation', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [{ messageId: 'm1', type: 'user', content: 'Ótimo atendimento', timestamp: 100 }]
      }

      const mockLLM = createMockLLM(() => {
        return '{"score": 95, "reason": "Atendimento rápido e eficiente"}'
      })

      const score = await calculateSatisfactionScore(conv, mockLLM)
      expect(score).toBe(95)
    })

    it('should clamp out-of-range satisfaction scores to 0-100', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [{ messageId: 'm1', type: 'user', content: 'Demais', timestamp: 100 }]
      }

      const mockLLM = createMockLLM(() => '{"score": 150}')
      const score = await calculateSatisfactionScore(conv, mockLLM)
      expect(score).toBe(100)
    })

    it('should extract topics with JSON validation', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [{ messageId: 'm1', type: 'user', content: 'Dúvida de frete e boleto', timestamp: 100 }]
      }

      const mockLLM = createMockLLM(() => {
        return '{"topics": ["Frete", "Segunda via de boleto", "Prazo de entrega"]}'
      })

      const topics = await extractTopics(conv, mockLLM)
      expect(topics).toEqual(['Frete', 'Segunda via de boleto', 'Prazo de entrega'])
    })

    it('should detect intents with JSON validation', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [{ messageId: 'm1', type: 'user', content: 'Quero cancelar o pedido', timestamp: 100 }]
      }

      const mockLLM = createMockLLM(() => {
        return '{"intents": ["cancelar_pedido", "solicitar_estorno"]}'
      })

      const intents = await detectIntents(conv, mockLLM)
      expect(intents).toEqual(['cancelar_pedido', 'solicitar_estorno'])
    })

    it('should extract and validate entities with type, value, confidence', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [{ messageId: 'm1', type: 'user', content: 'Comprei o iPhone 15 por R$ 5000', timestamp: 100 }]
      }

      const mockLLM = createMockLLM(() => {
        return JSON.stringify({
          entities: [
            { type: 'produto', value: 'iPhone 15', confidence: 0.98 },
            { type: 'valor', value: 'R$ 5000', confidence: 1.0 },
            { type: '', value: 'invalido' } // deve ser ignorado pela validação
          ]
        })
      })

      const entities = await extractEntities(conv, mockLLM)
      expect(entities).toHaveLength(2)
      expect(entities[0]).toEqual({ type: 'produto', value: 'iPhone 15', confidence: 0.98 })
      expect(entities[1]).toEqual({ type: 'valor', value: 'R$ 5000', confidence: 1.0 })
    })

    it('should identify pain points with JSON schema', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [{ messageId: 'm1', type: 'user', content: 'Demorou muito e o link deu erro', timestamp: 100 }]
      }

      const mockLLM = createMockLLM(() => {
        return '{"painPoints": ["Lentidão no carregamento", "Link quebrado no email"]}'
      })

      const points = await identifyPainPoints(conv, mockLLM)
      expect(points).toEqual(['Lentidão no carregamento', 'Link quebrado no email'])
    })

    it('should identify sales opportunities with JSON schema', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [{ messageId: 'm1', type: 'user', content: 'Preciso de mais armazenamento', timestamp: 100 }]
      }

      const mockLLM = createMockLLM(() => {
        return '{"opportunities": ["Upgrade para Plano Pro 1TB", "Backup em nuvem adicional"]}'
      })

      const opps = await identifySalesOpportunities(conv, mockLLM)
      expect(opps).toEqual(['Upgrade para Plano Pro 1TB', 'Backup em nuvem adicional'])
    })

    it('should generate recommendations with JSON schema', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [
          { messageId: 'm1', type: 'user', content: 'Não consigo acessar', timestamp: 100 },
          { messageId: 'm2', type: 'agent', content: 'Vou resetar sua senha', timestamp: 200 }
        ]
      }

      const mockLLM = createMockLLM(() => {
        return '{"recommendations": ["Enviar email com passo-a-passo de reset", "Monitorar próximo login"]}'
      })

      const recs = await generateRecommendations(conv, mockLLM)
      expect(recs).toEqual(['Enviar email com passo-a-passo de reset', 'Monitorar próximo login'])
    })

    it('should generate complete conversation insights aggregating all metrics', async () => {
      const conv: ConversationData = {
        conversationId: 'c1',
        messages: [
          { messageId: 'm1', type: 'user', content: 'Gostaria de saber sobre o plano Enterprise', timestamp: 100 }
        ]
      }

      const mockLLM = createMockLLM((prompt) => {
        if (prompt.includes('principais tópicos')) return '{"topics": ["Plano Enterprise"]}'
        if (prompt.includes('intenções')) return '{"intents": ["solicitar_proposta"]}'
        if (prompt.includes('entidades')) return '{"entities": [{"type": "plano", "value": "Enterprise", "confidence": 1.0}]}'
        if (prompt.includes('pontos de dor')) return '{"painPoints": ["Falta de clareza na tabela de preços"]}'
        if (prompt.includes('oportunidades')) return '{"opportunities": ["Demonstração com executivo de vendas"]}'
        if (prompt.includes('recomendações')) return '{"recommendations": ["Agendar call comercial em até 2 horas"]}'
        return '{}'
      })

      const insights = await generateConversationInsights(conv, mockLLM)
      expect(insights.topics).toEqual(['Plano Enterprise'])
      expect(insights.intents).toEqual(['solicitar_proposta'])
      expect(insights.entities).toHaveLength(1)
      expect(insights.painPoints).toEqual(['Falta de clareza na tabela de preços'])
      expect(insights.salesOpportunities).toEqual(['Demonstração com executivo de vendas'])
      expect(insights.recommendations).toEqual(['Agendar call comercial em até 2 horas'])
    })
  })
})
