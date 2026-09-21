import { TemporalGraph } from '../src/temporalGraph'
import { GraphQueryBuilder } from '../src/dsl/queryBuilder'
import { GraphPruner } from '../src/pruning/graphPruner'

describe('CT-RAG temporal and causal invariants', () => {
  function graph() {
    const value = new TemporalGraph<{ id: string }>(node => node.id, { clock: () => 100 })
    value.insertNode({ id: 'event:A' }, { valid_start: 0, observed_at: 10, ingested_at: 12 })
    value.insertNode({ id: 'event:B' }, { valid_start: 0, observed_at: 20, ingested_at: 22 })
    return value
  }

  it('never turns temporal adjacency into causal evidence', async () => {
    const value = graph()
    value.addTemporalEdge('event:A', 'event:B', 30, undefined, 40, {
      relation_kind: 'adjacency',
      observed_at: 35
    })

    const result = await new GraphQueryBuilder(value).causalOnly().execute()
    expect(result.edges).toEqual([])
  })

  it('requires explicit evidence for causal edges', () => {
    const value = graph()
    expect(() => value.addTemporalEdge('event:A', 'event:B', 30, undefined, 40, {
      relation_kind: 'causal'
    })).toThrow('Causal edges require evidence_refs or causation_id')

    const edge = value.addTemporalEdge('event:A', 'event:B', 30, undefined, 40, {
      relation_kind: 'causal',
      event_id: 'event:B',
      causation_id: 'event:A',
      evidence_refs: [{ kind: 'event', id: 'event:A' }],
      trace_id: 'trace:1',
      span_id: 'span:2'
    })
    expect(edge.relation_kind).toBe('causal')
  })

  it('supports valid-time plus observation-time reconstruction', async () => {
    const value = graph()
    value.addTemporalEdge('event:A', 'event:B', 30, undefined, 50, {
      observed_at: 45,
      ingested_at: 47
    })

    expect((await new GraphQueryBuilder(value).activeAt(40).observedBefore(44).execute()).edges).toHaveLength(0)
    expect((await new GraphQueryBuilder(value).activeAt(40).observedBefore(45).execute()).edges).toHaveLength(1)
    expect((await new GraphQueryBuilder(value).activeAt(50).observedBefore(60).execute()).edges).toHaveLength(0)
  })

  it('protects canonical evidence from relevance pruning', () => {
    const value = graph()
    const evidence = value.addTemporalEdge('event:A', 'event:B', 1, undefined, 2, {
      relation_kind: 'causal',
      causation_id: 'event:A'
    })
    const pruner = new GraphPruner(value)
    const report = pruner.pruneEdges({ currentTime: 1_000_000_000, scoreThreshold: 0.999 })

    expect(report.protectedEdgeIds).toContain(evidence.id)
    expect(value.getEdge(evidence.id)).toBeDefined()
  })
})
