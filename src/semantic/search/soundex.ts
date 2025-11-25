/**
 * Busca usando algoritmo Soundex (similaridade fonética)
 */

import { SemanticSearchResult, SemanticTemporalNode } from '../types'

/**
 * Gera código Soundex para uma string
 */
export function soundex(str: string): string {
  const s = str.toUpperCase().replace(/[^A-Z]/g, '')
  if (!s) return ''

  const first = s[0]
  let code = first

  const mapping: Record<string, string> = {
    'B': '1', 'F': '1', 'P': '1', 'V': '1',
    'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
    'D': '3', 'T': '3',
    'L': '4',
    'M': '5', 'N': '5',
    'R': '6'
  }

  for (let i = 1; i < s.length; i++) {
    const char = s[i]
    const digit = mapping[char] || ''

    // Não adiciona dígitos duplicados consecutivos
    if (digit && digit !== code[code.length - 1]) {
      code += digit
    }
  }

  // Remove a primeira letra e preenche com zeros até ter 3 dígitos
  code = code.slice(1).replace(/[A-Z]/g, '')
  code = (code + '000').slice(0, 3)

  return first + code
}

/**
 * Verifica se duas strings são foneticamente similares usando Soundex
 */
export function soundexMatch(a: string, b: string): boolean {
  return soundex(a) === soundex(b)
}

/**
 * Busca usando Soundex
 */
export function searchSoundex(
  query: string,
  nodes: SemanticTemporalNode[],
  limit: number = 10
): SemanticSearchResult[] {
  const querySoundex = soundex(query)
  const results: SemanticSearchResult[] = []

  for (const node of nodes) {
    const matchedFields: string[] = []

    // Verifica texto principal
    if (soundexMatch(query, node.data.text)) {
      matchedFields.push('text')
    }

    // Verifica campos adicionais
    if (node.data.fields) {
      for (const [field, value] of Object.entries(node.data.fields)) {
        if (typeof value === 'string' && soundexMatch(query, value)) {
          matchedFields.push(field)
        }
      }
    }

    if (matchedFields.length > 0) {
      results.push({
        node,
        score: 1.0, // Soundex é match exato fonético
        matchType: 'soundex',
        matchedFields
      })
    }
  }

  return results.slice(0, limit)
}

