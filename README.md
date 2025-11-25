# SemTempo GraphRAG

> Sistema avançado de GraphRAG (Retrieval Augmented Generation) para análise de grafos temporais com capacidades semânticas, ideal para CRM, análise de conversas e geração de insights de vendas.

## 📋 Índice

- [Visão Geral](#visao-geral)
- [Instalação](#instalacao)
- [Configuração Inicial](#configuracao-inicial)
- [Funcionalidades Principais](#funcionalidades-principais)
  - [Grafos Temporais](#grafos-temporais)
  - [Busca Semântica](#busca-semantica)
  - [Analytics de Conversas](#analytics-de-conversas)
  - [Métricas Temporais](#metricas-temporais)
- [Exemplos Práticos: CRM via WhatsApp](#exemplos-praticos-crm-via-whatsapp)
- [Como Gerar Insights](#como-gerar-insights)
- [Métricas Disponíveis](#metricas-disponiveis)
- [API Reference](#api-reference)
- [Contribuindo](#contribuindo)

---

## 🎯 Visão Geral {#visao-geral}

O **SemTempo GraphRAG** é uma biblioteca TypeScript poderosa que combina:

- **Grafos Temporais**: Modelagem de relacionamentos que mudam ao longo do tempo
- **Busca Semântica**: Encontre informações usando IA e embeddings vetoriais
- **Analytics Avançado**: Análise profunda de conversas, métricas e insights
- **GraphRAG**: Geração de respostas baseadas em contexto do grafo

### Casos de Uso

- 📱 **CRM via WhatsApp**: Análise de conversas de vendas e atendimento
- 💬 **Análise de Conversas**: Extração de insights de chats e mensagens
- 📊 **Métricas de Performance**: Análise temporal de interações
- 🔍 **Busca Inteligente**: Encontre informações relacionadas semanticamente
- 🤖 **Geração de Insights**: IA para identificar oportunidades e problemas

---

## 📦 Instalação {#instalacao}

```bash
# Usando bun (recomendado)
bun add @purecore/semtempo-graphrag

# Ou usando npm
npm install @purecore/semtempo-graphrag

# Ou usando yarn
yarn add @purecore/semtempo-graphrag
```

### Requisitos

- Node.js >= 18.0.0
- TypeScript (opcional, mas recomendado)

---

## ⚙️ Configuração Inicial {#configuracao-inicial}

### 1. Importar o Módulo

```typescript
import { 
  SemanticTemporalGraph,
  calculateConversationMetrics,
  generateConversationInsights,
  analyzeSentiment,
  extractTopics,
  identifySalesOpportunities
} from '@purecore/semtempo-graphrag'
```

### 2. Configurar Provedores de IA

Você precisa configurar provedores de **embeddings** (para busca semântica) e **LLM** (para análise e geração de insights).

#### Opção 1: OpenAI (Recomendado)

```typescript
const graph = new SemanticTemporalGraph((data) => data.id)

// Configurar embeddings (para busca semântica)
graph.setEmbeddingProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-ada-002'
})

// Configurar LLM (para análise e insights)
graph.setLLMProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000
})
```

#### Opção 2: OpenRouter (Múltiplos Modelos)

```typescript
// Usando modelos via OpenRouter
graph.setEmbeddingProvider({
  type: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY!,
  model: 'openai/text-embedding-ada-002'
})

graph.setLLMProvider({
  type: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY!,
  model: 'anthropic/claude-3-opus',
  temperature: 0.7
})
```

---

## 🚀 Funcionalidades Principais {#funcionalidades-principais}

### Grafos Temporais {#grafos-temporais}

Grafos temporais permitem modelar relacionamentos que existem em intervalos de tempo específicos.

#### Exemplo: Modelando Conversas de WhatsApp

```typescript
// Criar um grafo para rastrear conversas de vendas
const salesGraph = new SemanticTemporalGraph((data) => data.id)

// Adicionar cliente como nó
await salesGraph.insertNode({
  id: 'cliente-123',
  text: 'João Silva - Cliente interessado em produtos de limpeza',
  fields: {
    nome: 'João Silva',
    telefone: '+5511999999999',
    categoria: 'limpeza',
    valorTotal: 0
  }
})

// Adicionar produto como nó
await salesGraph.insertNode({
  id: 'produto-456',
  text: 'Detergente Premium 500ml - R$ 12,90',
  fields: {
    nome: 'Detergente Premium',
    categoria: 'limpeza',
    preco: 12.90,
    estoque: 150
  }
})

// Criar aresta temporal: cliente interagiu com produto
// A conversa começou às 10:00 e terminou às 10:15
const inicioConversa = new Date('2024-01-15T10:00:00').getTime()
const fimConversa = new Date('2024-01-15T10:15:00').getTime()

await salesGraph.addTemporalEdge(
  'cliente-123',
  'produto-456',
  inicioConversa,
  {
    text: 'Cliente perguntou sobre o produto e demonstrou interesse',
    fields: {
      tipoInteracao: 'consulta',
      resultado: 'interesse'
    }
  },
  fimConversa
)
```

### Busca Semântica {#busca-semantica}

O SemTempo GraphRAG oferece **6 tipos diferentes de busca** para encontrar informações relacionadas:

#### 1. Busca por Similaridade (Similarity)

Encontra nós semanticamente similares usando embeddings vetoriais.

```typescript
// Buscar produtos similares ao que o cliente mencionou
const resultados = await salesGraph.search({
  query: 'produtos para limpar cozinha',
  searchType: 'similarity',
  threshold: 0.7, // Similaridade mínima (0-1)
  limit: 10
})

resultados.forEach(result => {
  console.log(`Produto: ${result.node.data.fields.nome}`)
  console.log(`Score: ${result.score}`)
  console.log(`Match: ${result.matchType}`)
})
```

**Exemplo Real CRM WhatsApp:**

```typescript
// Cliente escreveu: "preciso de algo para limpar pia"
const produtos = await salesGraph.search({
  query: 'produto para limpar pia da cozinha',
  searchType: 'similarity',
  threshold: 0.75
})

// Resultados podem incluir:
// - Detergente (score: 0.89)
// - Desengordurante (score: 0.82)
// - Limpador multiuso (score: 0.78)
```

#### 2. Busca Híbrida (Hybrid)

Combina múltiplas estratégias de busca para resultados mais precisos.

```typescript
const resultados = await salesGraph.search({
  query: 'detergente barato',
  searchType: 'hybrid',
  threshold: 0.7,
  limit: 5
})
```

#### 3. Busca Vetorial (Vector)

Busca em campos específicos com threshold configurável e fallback.

```typescript
// Buscar produtos por categoria e preço
const produtosBaratos = await salesGraph.search({
  query: 'produtos de limpeza com preço baixo',
  searchType: 'vector',
  fields: ['categoria', 'nome', 'descricao'], // Campos a buscar
  threshold: 0.8,
  useFallback: true, // Retorna resultados abaixo do threshold se necessário
  limit: 10
})
```

**Exemplo Real:**

```typescript
// Cliente: "quero algo barato para limpar"
const opcoes = await salesGraph.search({
  query: 'produto barato limpeza',
  searchType: 'vector',
  fields: ['categoria', 'preco', 'nome'],
  threshold: 0.75,
  useFallback: true
})

// Retorna produtos com preço < R$ 15 ordenados por similaridade
```

#### 4. Busca Fuzzy

Busca aproximada usando algoritmo de Levenshtein (útil para erros de digitação).

```typescript
// Cliente digitou errado: "detergente" → "detergente" (com erro)
const resultados = await salesGraph.search({
  query: 'detergente', // Com erro de digitação
  searchType: 'fuzzy',
  threshold: 0.6, // Tolerância a erros
  limit: 5
})
```

#### 5. Busca Soundex

Busca fonética - encontra palavras que soam similares.

```typescript
// Útil para nomes próprios ou termos similares
const resultados = await salesGraph.search({
  query: 'joao silva', // Pode encontrar "João Silva", "Joao Silva", etc.
  searchType: 'soundex',
  limit: 10
})
```

#### 6. Busca por Índice (Index)

Busca rápida usando índice invertido (mais rápida, menos precisa).

```typescript
const resultados = await salesGraph.search({
  query: 'limpeza',
  searchType: 'index',
  limit: 20
})
```

---

## 📊 Analytics de Conversas {#analytics-de-conversas}

### Análise Completa de Conversas de WhatsApp

O SemTempo GraphRAG oferece análise completa de conversas com métricas e insights gerados por IA.

#### Exemplo: Analisando Conversa de Vendas

```typescript
import {
  calculateConversationMetrics,
  generateConversationInsights,
  analyzeSentiment,
  extractTopics,
  identifySalesOpportunities
} from '@purecore/semtempo-graphrag'

// Dados de uma conversa real de WhatsApp
const conversa = {
  conversationId: 'whatsapp-12345',
  messages: [
    {
      messageId: 'msg-1',
      type: 'user',
      content: 'Oi, vocês têm detergente?',
      timestamp: new Date('2024-01-15T10:00:00').getTime()
    },
    {
      messageId: 'msg-2',
      type: 'agent',
      content: 'Olá! Sim, temos vários tipos. Qual você precisa?',
      timestamp: new Date('2024-01-15T10:00:30').getTime()
    },
    {
      messageId: 'msg-3',
      type: 'user',
      content: 'Preciso de um que seja bom para pia e não seja muito caro',
      timestamp: new Date('2024-01-15T10:01:15').getTime()
    },
    {
      messageId: 'msg-4',
      type: 'agent',
      content: 'Perfeito! Temos o Detergente Premium por R$ 12,90. É econômico e eficiente.',
      timestamp: new Date('2024-01-15T10:01:45').getTime()
    },
    {
      messageId: 'msg-5',
      type: 'user',
      content: 'Quanto tempo dura?',
      timestamp: new Date('2024-01-15T10:02:00').getTime()
    },
    {
      messageId: 'msg-6',
      type: 'agent',
      content: 'Um frasco de 500ml dura cerca de 1 mês com uso normal.',
      timestamp: new Date('2024-01-15T10:02:20').getTime()
    },
    {
      messageId: 'msg-7',
      type: 'user',
      content: 'Ok, vou querer 2 unidades. Como faço o pedido?',
      timestamp: new Date('2024-01-15T10:03:00').getTime()
    },
    {
      messageId: 'msg-8',
      type: 'agent',
      content: 'Ótimo! Total: R$ 25,80. Pode pagar via PIX?',
      timestamp: new Date('2024-01-15T10:03:15').getTime()
    },
    {
      messageId: 'msg-9',
      type: 'user',
      content: 'Sim, pode ser PIX',
      timestamp: new Date('2024-01-15T10:03:30').getTime()
    },
    {
      messageId: 'msg-10',
      type: 'agent',
      content: 'Perfeito! Enviando o QR Code do PIX...',
      timestamp: new Date('2024-01-15T10:03:45').getTime()
    }
  ],
  metadata: {
    customerId: 'cliente-123',
    agentId: 'vendedor-456',
    channel: 'whatsapp',
    startedAt: new Date('2024-01-15T10:00:00').getTime(),
    endedAt: new Date('2024-01-15T10:15:00').getTime(),
    tags: ['venda', 'resolved', 'pix']
  }
}

// 1. Calcular Métricas Básicas
const metricas = calculateConversationMetrics(conversa)

console.log('📊 Métricas da Conversa:')
console.log(`Duração: ${metricas.duration}ms (${metricas.duration / 1000 / 60} minutos)`)
console.log(`Total de mensagens: ${metricas.messageCount}`)
console.log(`Mensagens do cliente: ${metricas.userMessageCount}`)
console.log(`Mensagens do vendedor: ${metricas.agentMessageCount}`)
console.log(`Tempo médio de resposta: ${metricas.averageResponseTime}ms (${metricas.averageResponseTime / 1000} segundos)`)
console.log(`Taxa de resolução: ${metricas.resolutionRate}`)

// 2. Análise de Sentimento
const sentimento = await analyzeSentiment(
  conversa.messages.map(m => m.content).join(' '),
  graph.getLLMProvider()!
)

console.log(`\n😊 Sentimento: ${sentimento}`)

// 3. Gerar Insights Completos (requer LLM configurado)
const insights = await generateConversationInsights(conversa, graph.getLLMProvider()!)

console.log('\n💡 Insights Gerados:')
console.log('Tópicos:', insights.topics)
console.log('Intenções:', insights.intents)
console.log('Entidades:', insights.entities)
console.log('Pontos de dor:', insights.painPoints)
console.log('Oportunidades de venda:', insights.salesOpportunities)
console.log('Recomendações:', insights.recommendations)
```

**Saída Esperada:**

```text
📊 Métricas da Conversa:
Duração: 900000ms (15 minutos)
Total de mensagens: 10
Mensagens do cliente: 5
Mensagens do vendedor: 5
Tempo médio de resposta: 15000ms (15 segundos)
Taxa de resolução: 1

😊 Sentimento: positive

💡 Insights Gerados:
Tópicos: [
  'Consulta de produto',
  'Preço e economia',
  'Durabilidade do produto',
  'Processo de compra',
  'Forma de pagamento'
]
Intenções: [
  'fazer pedido',
  'solicitar informação',
  'comparar preços'
]
Entidades: [
  { type: 'produto', value: 'Detergente Premium', confidence: 0.95 },
  { type: 'preço', value: 'R$ 12,90', confidence: 0.98 },
  { type: 'quantidade', value: '2 unidades', confidence: 0.92 },
  { type: 'pagamento', value: 'PIX', confidence: 0.99 }
]
Pontos de dor: [
  'Cliente preocupado com custo-benefício',
  'Necessidade de informação sobre durabilidade'
]
Oportunidades de venda: [
  'Cliente comprou 2 unidades - pode oferecer desconto para 3+',
  'Interesse em economia - apresentar produtos em promoção',
  'Cliente satisfeito - oportunidade de upsell de produtos relacionados'
]
Recomendações: [
  'Seguir com cliente após entrega para feedback',
  'Oferecer produtos complementares na próxima interação',
  'Adicionar cliente à lista de promoções'
]
```

---

## 📈 Métricas Temporais {#metricas-temporais}

### Análise de Padrões Temporais em Conversas

O SemTempo GraphRAG oferece métricas avançadas para análise temporal de interações.

```typescript
import { TemporalGraph } from '@purecore/semtempo-graphrag'
import {
  temporalDensity,
  interactionVelocity,
  temporalIntensity,
  graphAliveRatio,
  temporalChangeRate
} from '@purecore/semtempo-graphrag/metrics'

// Criar grafo temporal de interações
const graph = new TemporalGraph((data) => data.id)

// Adicionar nós (clientes, produtos, etc.)
graph.insertNode({ id: 'cliente-1' })
graph.insertNode({ id: 'produto-1' })
graph.insertNode({ id: 'vendedor-1' })

// Adicionar interações temporais
const inicioDia = new Date('2024-01-15T08:00:00').getTime()
const fimDia = new Date('2024-01-15T18:00:00').getTime()

// Cliente interagiu com produto das 10:00 às 10:15
graph.addTemporalEdge(
  'cliente-1',
  'produto-1',
  new Date('2024-01-15T10:00:00').getTime(),
  { tipo: 'consulta' },
  new Date('2024-01-15T10:15:00').getTime()
)

// Vendedor interagiu com cliente das 10:05 às 10:20
graph.addTemporalEdge(
  'vendedor-1',
  'cliente-1',
  new Date('2024-01-15T10:05:00').getTime(),
  { tipo: 'atendimento' },
  new Date('2024-01-15T10:20:00').getTime()
)

// Calcular métricas temporais
const t0 = inicioDia
const t1 = fimDia

console.log('📊 Métricas Temporais:')
console.log(`Densidade temporal: ${temporalDensity(graph, t0, t1)}`)
console.log(`Velocidade de interação: ${interactionVelocity(graph, t0, t1)} interações/min`)
console.log(`Intensidade temporal: ${temporalIntensity(graph, t0, t1)} eventos/min`)
console.log(`Taxa de atividade: ${graphAliveRatio(graph, t0, t1)}`)
console.log(`Taxa de mudança: ${temporalChangeRate(graph, t0, t1)} mudanças/min`)
```

### Exemplo: Métricas de Nós

```typescript
import {
  temporalDegree,
  nodeLifespan,
  nodeBurstiness
} from '@purecore/semtempo-graphrag/metrics'

// Grau temporal de um cliente (quantas interações teve)
const grauCliente = temporalDegree(graph, 'cliente-1', t0, t1)
console.log(`Grau temporal do cliente: ${grauCliente}`)

// Lifespan (tempo de vida do nó no grafo)
const lifespan = nodeLifespan(graph, 'cliente-1')
console.log(`Lifespan: ${lifespan}ms`)

// Burstiness (quão "explosivo" são as interações)
const burstiness = nodeBurstiness(graph, 'cliente-1')
console.log(`Burstiness: ${burstiness}`) // -1 a 1, quanto mais próximo de 1, mais "bursty"
```

### Exemplo: Métricas de Arestas

```typescript
import {
  edgeDuration,
  averageEdgeDurationBetween,
  edgeRecurrence
} from '@purecore/semtempo-graphrag/metrics'

// Duração de uma interação específica
const edges = graph.getAllEdges()
const duracao = edgeDuration(edges[0])
console.log(`Duração da interação: ${duracao}ms`)

// Duração média entre dois nós
const duracaoMedia = averageEdgeDurationBetween(
  graph,
  'cliente-1',
  'produto-1'
)
console.log(`Duração média: ${duracaoMedia}ms`)

// Recorrência (quantas vezes a relação aconteceu)
const recorrencia = edgeRecurrence(graph, 'cliente-1', 'produto-1')
console.log(`Recorrência: ${recorrencia} vezes`)
```

---

## 💼 Exemplos Práticos: CRM via WhatsApp {#exemplos-praticos-crm-via-whatsapp}

### Exemplo 1: Sistema Completo de Análise de Vendas

```typescript
import { SemanticTemporalGraph } from '@purecore/semtempo-graphrag'
import {
  calculateConversationMetrics,
  generateConversationInsights,
  identifySalesOpportunities
} from '@purecore/semtempo-graphrag'

// 1. Configurar o grafo
const crmGraph = new SemanticTemporalGraph((data) => data.id)

crmGraph.setEmbeddingProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-ada-002'
})

crmGraph.setLLMProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
})

// 2. Cadastrar produtos
const produtos = [
  {
    id: 'prod-1',
    text: 'Detergente Premium 500ml - R$ 12,90 - Ideal para limpeza pesada',
    fields: {
      nome: 'Detergente Premium',
      categoria: 'limpeza',
      preco: 12.90,
      volume: '500ml',
      descricao: 'Ideal para limpeza pesada de pias e panelas'
    }
  },
  {
    id: 'prod-2',
    text: 'Desengordurante Ultra 1L - R$ 18,50 - Remove gordura difícil',
    fields: {
      nome: 'Desengordurante Ultra',
      categoria: 'limpeza',
      preco: 18.50,
      volume: '1L',
      descricao: 'Remove gordura difícil de fogões e coifas'
    }
  },
  {
    id: 'prod-3',
    text: 'Limpador Multiuso 750ml - R$ 15,90 - Uso geral',
    fields: {
      nome: 'Limpador Multiuso',
      categoria: 'limpeza',
      preco: 15.90,
      volume: '750ml',
      descricao: 'Uso geral para diversas superfícies'
    }
  }
]

for (const produto of produtos) {
  await crmGraph.insertNode(produto)
}

// 3. Processar conversa de WhatsApp
async function processarConversaWhatsApp(conversa: any) {
  // Adicionar cliente ao grafo
  await crmGraph.insertNode({
    id: conversa.metadata.customerId,
    text: `${conversa.metadata.customerId} - Cliente WhatsApp`,
    fields: {
      telefone: conversa.metadata.telefone,
      canal: 'whatsapp'
    }
  })

  // Calcular métricas
  const metricas = calculateConversationMetrics(conversa)
  
  // Gerar insights
  const insights = await generateConversationInsights(
    conversa,
    crmGraph.getLLMProvider()!
  )

  // Buscar produtos recomendados baseado na conversa
  const textoConversa = conversa.messages
    .map((m: any) => m.content)
    .join(' ')

  const produtosRecomendados = await crmGraph.search({
    query: textoConversa,
    searchType: 'hybrid',
    threshold: 0.7,
    limit: 5
  })

  return {
    metricas,
    insights,
    produtosRecomendados: produtosRecomendados.map(r => ({
      produto: r.node.data.fields.nome,
      preco: r.node.data.fields.preco,
      score: r.score,
      motivo: `Similaridade: ${(r.score * 100).toFixed(1)}%`
    }))
  }
}

// 4. Usar o sistema
const conversa = {
  conversationId: 'whatsapp-123',
  messages: [
    { messageId: '1', type: 'user', content: 'Preciso de algo para limpar pia', timestamp: Date.now() },
    { messageId: '2', type: 'agent', content: 'Temos o Detergente Premium por R$ 12,90', timestamp: Date.now() + 5000 },
    { messageId: '3', type: 'user', content: 'Quanto tempo dura?', timestamp: Date.now() + 10000 },
    { messageId: '4', type: 'agent', content: 'Dura cerca de 1 mês', timestamp: Date.now() + 15000 },
    { messageId: '5', type: 'user', content: 'Ok, vou querer 2', timestamp: Date.now() + 20000 }
  ],
  metadata: {
    customerId: 'cliente-123',
    telefone: '+5511999999999',
    startedAt: Date.now(),
    endedAt: Date.now() + 25000
  }
}

const resultado = await processarConversaWhatsApp(conversa)

console.log('📊 Análise Completa:')
console.log(JSON.stringify(resultado, null, 2))
```

### Exemplo 2: Dashboard de Métricas de Vendas

```typescript
import { TemporalGraph } from '@purecore/semtempo-graphrag'
import {
  temporalDensity,
  interactionVelocity,
  activationsInInterval,
  deactivationsInInterval
} from '@purecore/semtempo-graphrag/metrics'

// Criar dashboard de métricas do dia
function criarDashboardVendas(grafo: TemporalGraph, data: Date) {
  const inicioDia = new Date(data.setHours(0, 0, 0, 0)).getTime()
  const fimDia = new Date(data.setHours(23, 59, 59, 999)).getTime()

  const metricas = {
    // Densidade de interações
    densidade: temporalDensity(grafo, inicioDia, fimDia),
    
    // Velocidade de interações (interações por minuto)
    velocidade: interactionVelocity(grafo, inicioDia, fimDia),
    
    // Novas interações iniciadas
    novasInteracoes: activationsInInterval(grafo, inicioDia, fimDia),
    
    // Interações finalizadas
    interacoesFinalizadas: deactivationsInInterval(grafo, inicioDia, fimDia),
    
    // Taxa de conversão (novas / finalizadas)
    taxaConversao: activationsInInterval(grafo, inicioDia, fimDia) / 
                   Math.max(deactivationsInInterval(grafo, inicioDia, fimDia), 1)
  }

  return metricas
}

// Usar o dashboard
const grafoVendas = new TemporalGraph((data) => data.id)
// ... adicionar dados ...

const dashboard = criarDashboardVendas(grafoVendas, new Date())
console.log('📊 Dashboard de Vendas:', dashboard)
```

### Exemplo 3: Sistema de Recomendação de Produtos

```typescript
async function recomendarProdutos(
  grafo: SemanticTemporalGraph,
  historicoCliente: string[]
) {
  // Buscar produtos baseado no histórico de compras
  const historicoTexto = historicoCliente.join(' ')
  
  const recomendacoes = await grafo.search({
    query: historicoTexto,
    searchType: 'hybrid',
    threshold: 0.75,
    limit: 10
  })

  // Filtrar produtos já comprados
  const produtosNovos = recomendacoes.filter(
    r => !historicoCliente.includes(r.node.id)
  )

  return produtosNovos.map(r => ({
    produto: r.node.data.fields.nome,
    preco: r.node.data.fields.preco,
    score: r.score,
    categoria: r.node.data.fields.categoria,
    motivo: `Baseado no seu histórico de compras (${(r.score * 100).toFixed(1)}% de similaridade)`
  }))
}

// Exemplo de uso
const historico = ['prod-1', 'prod-2'] // Cliente já comprou estes
const recomendacoes = await recomendarProdutos(crmGraph, historico)

console.log('🎯 Produtos Recomendados:')
recomendacoes.forEach(rec => {
  console.log(`- ${rec.produto} (R$ ${rec.preco}) - ${rec.motivo}`)
})
```

---

## 🧠 Como Gerar Insights {#como-gerar-insights}

### Passo a Passo: Gerando Insights de Conversas

#### 1. Preparar os Dados

```typescript
const conversa = {
  conversationId: 'conv-123',
  messages: [
    // ... mensagens ...
  ],
  metadata: {
    customerId: 'cliente-123',
    agentId: 'vendedor-456',
    channel: 'whatsapp',
    startedAt: Date.now() - 900000, // 15 min atrás
    endedAt: Date.now(),
    tags: ['venda', 'resolved']
  }
}
```

#### 2. Calcular Métricas Básicas

```typescript
const metricas = calculateConversationMetrics(conversa)

// Métricas disponíveis:
// - duration: Duração total (ms)
// - messageCount: Total de mensagens
// - userMessageCount: Mensagens do cliente
// - agentMessageCount: Mensagens do vendedor
// - averageResponseTime: Tempo médio de resposta (ms)
// - resolutionRate: Taxa de resolução (0-1)
```

#### 3. Análise de Sentimento

```typescript
// Análise de sentimento de uma mensagem específica
const sentimentoMsg = await analyzeSentiment(
  'Estou muito satisfeito com o produto!',
  llmProvider
) // 'positive' | 'neutral' | 'negative'

// Análise de sentimento da conversa inteira
const sentimentoConversa = await analyzeConversationSentiment(
  conversa,
  llmProvider
)
```

#### 4. Score de Satisfação

```typescript
const satisfacao = await calculateSatisfactionScore(
  conversa,
  llmProvider
) // 0-100

if (satisfacao >= 85) {
  console.log('✅ Cliente muito satisfeito!')
} else if (satisfacao >= 70) {
  console.log('👍 Cliente satisfeito')
} else {
  console.log('⚠️ Cliente insatisfeito - ação necessária')
}
```

#### 5. Extração de Tópicos

```typescript
const topicos = await extractTopics(conversa, llmProvider)
// Retorna: ['Consulta de produto', 'Preço', 'Forma de pagamento', ...]
```

#### 6. Detecção de Intenções

```typescript
const intencoes = await detectIntents(conversa, llmProvider)
// Retorna: ['fazer pedido', 'solicitar informação', 'reclamar', ...]
```

#### 7. Extração de Entidades

```typescript
const entidades = await extractEntities(conversa, llmProvider)
// Retorna: [
//   { type: 'produto', value: 'Detergente Premium', confidence: 0.95 },
//   { type: 'preço', value: 'R$ 12,90', confidence: 0.98 },
//   ...
// ]
```

#### 8. Identificação de Pontos de Dor

```typescript
const pontosDor = await identifyPainPoints(conversa, llmProvider)
// Retorna: [
//   'Cliente preocupado com custo-benefício',
//   'Dúvida sobre durabilidade do produto',
//   ...
// ]
```

#### 9. Oportunidades de Venda

```typescript
const oportunidades = await identifySalesOpportunities(
  conversa,
  llmProvider
)
// Retorna: [
//   'Cliente comprou 2 unidades - oferecer desconto para 3+',
//   'Interesse em economia - apresentar produtos em promoção',
//   ...
// ]
```

#### 10. Recomendações de Ação

```typescript
const recomendacoes = await generateRecommendations(
  conversa,
  llmProvider
)
// Retorna: [
//   'Seguir com cliente após entrega para feedback',
//   'Oferecer produtos complementares na próxima interação',
//   ...
// ]
```

#### 11. Insights Completos (Tudo de Uma Vez)

```typescript
const insights = await generateConversationInsights(
  conversa,
  llmProvider
)

// Retorna objeto completo com:
// - topics: Tópicos principais
// - intents: Intenções detectadas
// - entities: Entidades extraídas
// - painPoints: Pontos de dor
// - salesOpportunities: Oportunidades de venda
// - recommendations: Recomendações de ação
```

### Exemplo Completo: Pipeline de Análise

```typescript
async function pipelineAnaliseCompleta(conversa: ConversationData) {
  // 1. Métricas básicas
  const metricas = calculateConversationMetrics(conversa)
  
  // 2. Insights gerados por IA
  const insights = await generateConversationInsights(conversa, llmProvider)
  
  // 3. Análise de sentimento
  const sentimento = await analyzeConversationSentiment(conversa, llmProvider)
  
  // 4. Score de satisfação
  const satisfacao = await calculateSatisfactionScore(conversa, llmProvider)
  
  // 5. Buscar produtos relacionados
  const textoConversa = conversa.messages.map(m => m.content).join(' ')
  const produtosRelacionados = await grafo.search({
    query: textoConversa,
    searchType: 'hybrid',
    threshold: 0.7,
    limit: 5
  })
  
  return {
    // Métricas quantitativas
    metricas: {
      ...metricas,
      sentimento,
      satisfacao
    },
    
    // Insights qualitativos
    insights,
    
    // Recomendações práticas
    acoes: {
      produtosRecomendados: produtosRelacionados.map(r => ({
        id: r.node.id,
        nome: r.node.data.fields.nome,
        preco: r.node.data.fields.preco,
        score: r.score
      })),
      proximosPassos: insights.recommendations,
      oportunidades: insights.salesOpportunities
    },
    
    // Alertas
    alertas: [
      ...(satisfacao < 70 ? ['Cliente insatisfeito - requer atenção'] : []),
      ...(metricas.averageResponseTime > 30000 ? ['Tempo de resposta alto'] : []),
      ...(insights.painPoints?.length > 0 ? ['Pontos de dor identificados'] : [])
    ]
  }
}

// Usar o pipeline
const analise = await pipelineAnaliseCompleta(conversa)
console.log(JSON.stringify(analise, null, 2))
```

---

## 📊 Métricas Disponíveis {#metricas-disponiveis}

### Métricas de Conversa

| Métrica | Descrição | Tipo |
|---------|-----------|------|
| `duration` | Duração total da conversa (ms) | number |
| `messageCount` | Total de mensagens | number |
| `userMessageCount` | Mensagens do cliente | number |
| `agentMessageCount` | Mensagens do vendedor | number |
| `averageResponseTime` | Tempo médio de resposta (ms) | number |
| `resolutionRate` | Taxa de resolução (0-1) | number |
| `sentiment` | Sentimento geral | 'positive' \| 'neutral' \| 'negative' |
| `satisfactionScore` | Score de satisfação (0-100) | number |

### Métricas Temporais do Grafo

| Métrica | Descrição | Função |
|---------|-----------|--------|
| `temporalDensity` | Densidade temporal (arestas ativas / máximo possível) | `temporalDensity(graph, t0, t1)` |
| `interactionVelocity` | Velocidade de interação (interações/min) | `interactionVelocity(graph, t0, t1)` |
| `temporalIntensity` | Intensidade temporal (eventos/min) | `temporalIntensity(graph, t0, t1)` |
| `graphAliveRatio` | Taxa de atividade do grafo (0-1) | `graphAliveRatio(graph, t0, t1)` |
| `temporalChangeRate` | Taxa de mudança (mudanças/min) | `temporalChangeRate(graph, t0, t1)` |
| `temporalOverlapRatio` | Percentual de overlap temporal | `temporalOverlapRatio(graph, t0, t1)` |
| `activationRhythm` | Ritmo médio de ativações | `activationRhythm(graph)` |

### Métricas de Nós

| Métrica | Descrição | Função |
|---------|-----------|--------|
| `temporalDegree` | Grau temporal (interações no período) | `temporalDegree(graph, nodeId, t0, t1)` |
| `nodeLifespan` | Tempo de vida do nó (ms) | `nodeLifespan(graph, nodeId)` |
| `nodeBurstiness` | Burstiness (-1 a 1) | `nodeBurstiness(graph, nodeId)` |

### Métricas de Arestas

| Métrica | Descrição | Função |
|---------|-----------|--------|
| `edgeDuration` | Duração de uma aresta (ms) | `edgeDuration(edge, now?)` |
| `averageEdgeDurationBetween` | Duração média entre dois nós | `averageEdgeDurationBetween(graph, fromId, toId)` |
| `edgeRecurrence` | Recorrência de uma relação | `edgeRecurrence(graph, fromId, toId)` |

---

## 🔍 API Reference {#api-reference}

### SemanticTemporalGraph

#### Métodos Principais

```typescript
// Criar instância
const graph = new SemanticTemporalGraph((data) => data.id)

// Configurar provedores
graph.setEmbeddingProvider(config: EmbeddingProviderConfig): void
graph.setLLMProvider(config: LLMProviderConfig): void

// Inserir nós e arestas
await graph.insertNode(data: NodeData): Promise<SemanticTemporalNode>
await graph.addTemporalEdge(
  from: string | NodeData,
  to: string | NodeData,
  activated_at: number,
  data?: EdgeData,
  deactivated_at?: number
): Promise<SemanticTemporalEdge>

// Busca
await graph.search(options: SemanticSearchOptions): Promise<SemanticSearchResult[]>

// Utilitários
await graph.embed(text: string): Promise<number[]>
await graph.complete(prompt: string, systemPrompt?: string): Promise<string>
async *graph.stream(prompt: string, systemPrompt?: string): AsyncIterable<string>
```

### Funções de Analytics

```typescript
// Métricas
calculateConversationMetrics(conversa: ConversationData): ConversationMetrics

// Análise
analyzeSentiment(message: string, llmProvider: LLMProvider): Promise<'positive' | 'neutral' | 'negative'>
analyzeConversationSentiment(conversa: ConversationData, llmProvider: LLMProvider): Promise<'positive' | 'neutral' | 'negative'>
calculateSatisfactionScore(conversa: ConversationData, llmProvider: LLMProvider): Promise<number>

// Extração
extractTopics(conversa: ConversationData, llmProvider: LLMProvider): Promise<string[]>
detectIntents(conversa: ConversationData, llmProvider: LLMProvider): Promise<string[]>
extractEntities(conversa: ConversationData, llmProvider: LLMProvider): Promise<Array<{type: string, value: string, confidence: number}>>

// Insights
identifyPainPoints(conversa: ConversationData, llmProvider: LLMProvider): Promise<string[]>
identifySalesOpportunities(conversa: ConversationData, llmProvider: LLMProvider): Promise<string[]>
generateRecommendations(conversa: ConversationData, llmProvider: LLMProvider): Promise<string[]>
generateConversationInsights(conversa: ConversationData, llmProvider: LLMProvider): Promise<ConversationInsights>
```

---

## 🎓 Casos de Uso Avançados

### 1. Análise de Performance de Vendedores

```typescript
async function analisarPerformanceVendedor(
  grafo: SemanticTemporalGraph,
  vendedorId: string,
  periodo: { inicio: number, fim: number }
) {
  const conversas = await buscarConversasVendedor(vendedorId, periodo)
  
  const analises = await Promise.all(
    conversas.map(conv => generateConversationInsights(conv, llmProvider))
  )
  
  return {
    totalConversas: conversas.length,
    taxaConversao: analises.filter(a => a.salesOpportunities?.length > 0).length / conversas.length,
    satisfacaoMedia: await calcularSatisfacaoMedia(conversas),
    topicosMaisComuns: extrairTopicosMaisComuns(analises),
    oportunidadesPerdidas: identificarOportunidadesPerdidas(analises)
  }
}
```

### 2. Sistema de Alertas Inteligentes

```typescript
async function criarSistemaAlertas(conversa: ConversationData) {
  const metricas = calculateConversationMetrics(conversa)
  const insights = await generateConversationInsights(conversa, llmProvider)
  const satisfacao = await calculateSatisfactionScore(conversa, llmProvider)
  
  const alertas = []
  
  // Alerta de insatisfação
  if (satisfacao < 70) {
    alertas.push({
      nivel: 'alto',
      tipo: 'insatisfacao',
      mensagem: 'Cliente insatisfeito - requer atenção imediata',
      acao: 'Contatar supervisor'
    })
  }
  
  // Alerta de tempo de resposta
  if (metricas.averageResponseTime > 30000) {
    alertas.push({
      nivel: 'medio',
      tipo: 'performance',
      mensagem: 'Tempo de resposta acima do ideal',
      acao: 'Revisar processos de atendimento'
    })
  }
  
  // Alerta de oportunidades
  if (insights.salesOpportunities && insights.salesOpportunities.length > 0) {
    alertas.push({
      nivel: 'baixo',
      tipo: 'oportunidade',
      mensagem: `${insights.salesOpportunities.length} oportunidades identificadas`,
      acao: 'Revisar recomendações de venda'
    })
  }
  
  return alertas
}
```

### 3. Análise de Tendências Temporais

```typescript
import {
  temporalDensity,
  interactionVelocity,
  activationsInInterval
} from '@purecore/semtempo-graphrag/metrics'

function analisarTendencias(
  grafo: TemporalGraph,
  periodos: Array<{ inicio: number, fim: number }>
) {
  return periodos.map(periodo => ({
    periodo: {
      inicio: new Date(periodo.inicio).toISOString(),
      fim: new Date(periodo.fim).toISOString()
    },
    densidade: temporalDensity(grafo, periodo.inicio, periodo.fim),
    velocidade: interactionVelocity(grafo, periodo.inicio, periodo.fim),
    novasInteracoes: activationsInInterval(grafo, periodo.inicio, periodo.fim)
  }))
}

// Comparar períodos
const hoje = new Date()
const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000)

const tendencias = analisarTendencias(grafo, [
  {
    inicio: ontem.setHours(0, 0, 0, 0),
    fim: ontem.setHours(23, 59, 59, 999)
  },
  {
    inicio: hoje.setHours(0, 0, 0, 0),
    fim: hoje.setHours(23, 59, 59, 999)
  }
])

console.log('📈 Tendências:', tendencias)
```

---

## 🤝 Contribuindo {#contribuindo}

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m '✨ feat: Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrão de Commits

Este projeto segue o padrão de commits com emojis:

- ✨ `:sparkles:` Nova funcionalidade
- 🐛 `:bug:` Correção de bug
- 📝 `:memo:` Documentação
- 🎨 `:art:` Formatação/estilos
- ♻️ `:recycle:` Refatoração
- ⚡️ `:zap:` Performance
- ✅ `:white_check_mark:` Testes
- 🔧 `:wrench:` Configurações

---

## 📚 Referências e Links

### Documentação

- [Documentação do Módulo Semântico](./src/semantic/README.md)
- [CHANGELOG](./CHANGELOG.md)

### Fontes de Informação

- [GraphRAG: Unlocking LLM discovery on narrative private data](https://www.microsoft.com/en-us/research/publication/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
- [Temporal Graph Networks](https://arxiv.org/abs/2006.10637)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [OpenRouter Documentation](https://openrouter.ai/docs)

### Provedores Suportados

- **OpenAI**: [Documentação](https://platform.openai.com/docs)
- **OpenRouter**: [Documentação](https://openrouter.ai/docs)

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](./LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- Equipe PureCore pelo desenvolvimento inicial
- Comunidade open source pelas contribuições

---

### Desenvolvido com ❤️ para análise inteligente de dados temporais
