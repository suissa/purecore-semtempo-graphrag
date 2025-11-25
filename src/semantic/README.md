# SemTempo Graph - Módulo Semântico

Módulo de busca semântica e análise para grafos temporais.

## Funcionalidades

### 🔍 Busca Semântica

- **Busca por Similaridade**: Usa embeddings para encontrar nós semanticamente similares
- **Busca Híbrida**: Combina múltiplas estratégias de busca
- **Busca Vetorial**: Busca em campos específicos com threshold e fallback
- **Busca Fuzzy**: Busca aproximada usando algoritmo de Levenshtein
- **Busca Soundex**: Busca fonética (similaridade de som)
- **Busca por Índices**: Índice invertido para busca rápida

### 🤖 Provedores

- **OpenAI**: Suporte completo para embeddings e LLMs
- **OpenRouter**: Suporte para múltiplos modelos via OpenRouter
- **Custom**: Suporte para provedores customizados

### 📊 Analytics de Conversas

- Métricas de conversa (duração, tempo de resposta, etc.)
- Análise de sentimento
- Extração de tópicos e intenções
- Identificação de pontos de dor
- Oportunidades de venda
- Recomendações de ação

## Uso Básico

```typescript
import { SemanticTemporalGraph } from './semantic'

// Cria o grafo semântico
const graph = new SemanticTemporalGraph((data) => data.id)

// Configura provedor de embeddings
graph.setEmbeddingProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-ada-002'
})

// Configura provedor de LLM
graph.setLLMProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
})

// Insere nós com dados semânticos
await graph.insertNode({
  id: 'node1',
  text: 'Produto X é excelente para limpeza',
  fields: {
    categoria: 'limpeza',
    preco: 29.90
  }
})

// Busca semântica
const results = await graph.search({
  query: 'produtos de limpeza',
  searchType: 'hybrid',
  threshold: 0.7,
  limit: 10
})
```

## Busca Vetorial com Fallback

```typescript
const results = await graph.search({
  query: 'produto barato para casa',
  searchType: 'vector',
  fields: ['text', 'categoria', 'descricao'],
  threshold: 0.8,
  useFallback: true, // Retorna resultados abaixo do threshold se não encontrar acima
  limit: 10
})
```

## Analytics de Conversas

```typescript
import { 
  calculateConversationMetrics,
  generateConversationInsights 
} from './semantic'

const conversation = {
  conversationId: 'conv1',
  messages: [...],
  metadata: {...}
}

// Calcula métricas
const metrics = calculateConversationMetrics(conversation)

// Gera insights usando LLM
const insights = await generateConversationInsights(conversation, llmProvider)
```

## Tipos de Busca

### Similarity
Busca por similaridade semântica usando embeddings.

### Fuzzy
Busca aproximada usando distância de Levenshtein.

### Soundex
Busca fonética - encontra palavras que soam similares.

### Index
Busca rápida usando índice invertido.

### Vector
Busca vetorial em campos específicos com threshold configurável.

### Hybrid
Combina múltiplas estratégias de busca com pesos configuráveis.

