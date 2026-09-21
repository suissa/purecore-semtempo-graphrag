import initSqlJs, { Database, SqlValue } from 'sql.js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { TemporalNode, TemporalEdge } from '../temporalGraph'
import { IGraphStorageAdapter, SQLiteStorageConfig, StorageTraversalResult } from './types'

type Params = Record<string, SqlValue> | SqlValue[]

/** Portable SQLite projection backed by sql.js (WASM), not an in-memory Map facade. */
export class SQLiteGraphStorage<NodeData = any, EdgeData = any>
  implements IGraphStorageAdapter<NodeData, EdgeData> {
  private db?: Database
  private readonly dbFilename: string
  private readonly autoMigrate: boolean

  constructor(config: SQLiteStorageConfig = {}) {
    this.dbFilename = config.filename ?? ':memory:'
    this.autoMigrate = config.autoMigrate ?? true
  }

  async init(): Promise<void> {
    if (this.db) return
    const SQL = await initSqlJs()
    this.db = this.dbFilename !== ':memory:' && existsSync(this.dbFilename)
      ? new SQL.Database(readFileSync(this.dbFilename))
      : new SQL.Database()
    this.db.run('PRAGMA foreign_keys = ON')
    if (this.autoMigrate) this.migrate()
  }

  private database(): Database {
    if (!this.db) throw new Error('SQLiteGraphStorage is not initialized')
    return this.db
  }

  private migrate(): void {
    this.database().run(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY, data_json TEXT NOT NULL, valid_start INTEGER, valid_end INTEGER,
        event_time INTEGER, observed_at INTEGER, ingested_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS graph_edges (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
        to_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
        valid_start INTEGER NOT NULL, valid_end INTEGER,
        event_time INTEGER NOT NULL, observed_at INTEGER NOT NULL, ingested_at INTEGER NOT NULL,
        relation_kind TEXT NOT NULL, evidence_refs_json TEXT NOT NULL,
        event_id TEXT, causation_id TEXT, correlation_id TEXT, trace_id TEXT, span_id TEXT,
        data_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_graph_edges_from_valid ON graph_edges(from_id, valid_start, valid_end);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_to_valid ON graph_edges(to_id, valid_start, valid_end);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_observed ON graph_edges(observed_at);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_relation ON graph_edges(relation_kind);
    `)
  }

  private run(sql: string, params: Params = []): void {
    this.database().run(sql, params)
  }

  private all(sql: string, params: Params = []): any[] {
    const statement = this.database().prepare(sql)
    try {
      statement.bind(params)
      const rows: any[] = []
      while (statement.step()) rows.push(statement.getAsObject())
      return rows
    } finally {
      statement.free()
    }
  }

  async saveNode(node: TemporalNode<NodeData>): Promise<void> {
    this.run(`
      INSERT INTO graph_nodes(id, data_json, valid_start, valid_end, event_time, observed_at, ingested_at)
      VALUES($id, $data, $vs, $ve, $et, $oa, $ia)
      ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json, valid_start=excluded.valid_start,
        valid_end=excluded.valid_end, event_time=excluded.event_time,
        observed_at=excluded.observed_at, ingested_at=excluded.ingested_at
    `, {
      $id: node.id, $data: JSON.stringify(node.data), $vs: node.valid_start ?? null,
      $ve: node.valid_end ?? null, $et: node.event_time ?? null,
      $oa: node.observed_at ?? null, $ia: node.ingested_at ?? null
    })
  }

  async saveEdge(edge: TemporalEdge<EdgeData>): Promise<void> {
    this.run(`
      INSERT INTO graph_edges(
        id, from_id, to_id, valid_start, valid_end, event_time, observed_at, ingested_at,
        relation_kind, evidence_refs_json, event_id, causation_id, correlation_id, trace_id, span_id, data_json
      ) VALUES($id,$from,$to,$vs,$ve,$et,$oa,$ia,$rk,$evidence,$event,$cause,$correlation,$trace,$span,$data)
      ON CONFLICT(id) DO UPDATE SET valid_end=excluded.valid_end, observed_at=excluded.observed_at,
        ingested_at=excluded.ingested_at, evidence_refs_json=excluded.evidence_refs_json,
        data_json=excluded.data_json
    `, this.serializeEdge(edge))
  }

  async getNode(id: string): Promise<TemporalNode<NodeData> | undefined> {
    const row = this.all('SELECT * FROM graph_nodes WHERE id = ?', [id])[0]
    return row ? this.deserializeNode(row) : undefined
  }

  async getEdge(id: string): Promise<TemporalEdge<EdgeData> | undefined> {
    const row = this.all('SELECT * FROM graph_edges WHERE id = ?', [id])[0]
    return row ? this.deserializeEdge(row) : undefined
  }

  async getAllNodes(): Promise<TemporalNode<NodeData>[]> {
    return this.all('SELECT * FROM graph_nodes ORDER BY id').map(row => this.deserializeNode(row))
  }

  async getAllEdges(): Promise<TemporalEdge<EdgeData>[]> {
    return this.all('SELECT * FROM graph_edges ORDER BY valid_start, id').map(row => this.deserializeEdge(row))
  }

  async deleteNode(id: string): Promise<void> { this.run('DELETE FROM graph_nodes WHERE id = ?', [id]) }
  async deleteEdge(id: string): Promise<void> { this.run('DELETE FROM graph_edges WHERE id = ?', [id]) }

  async getEdgesInInterval(start: number, end: number): Promise<TemporalEdge<EdgeData>[]> {
    if (end <= start) throw new Error('end must be greater than start')
    return this.all(`
      SELECT * FROM graph_edges
      WHERE valid_start < $end AND (valid_end IS NULL OR $start < valid_end)
      ORDER BY valid_start, id
    `, { $start: start, $end: end }).map(row => this.deserializeEdge(row))
  }

  async bfsTraversal(startNodeId: string, maxDepth = 2): Promise<StorageTraversalResult<NodeData, EdgeData>> {
    const rows = this.all(`
      WITH RECURSIVE walk(node_id, depth, path) AS (
        SELECT $start, 0, '|' || $start || '|'
        UNION ALL
        SELECT e.to_id, walk.depth + 1, walk.path || e.to_id || '|'
        FROM walk JOIN graph_edges e ON e.from_id = walk.node_id
        WHERE walk.depth < $depth AND instr(walk.path, '|' || e.to_id || '|') = 0
      ) SELECT node_id, depth, path FROM walk ORDER BY depth, node_id
    `, { $start: startNodeId, $depth: maxDepth })
    const nodeIds = [...new Set(rows.map(row => String(row.node_id)))]
    if (nodeIds.length === 0 || !await this.getNode(startNodeId)) return { nodes: [], edges: [], paths: [] }
    const placeholders = nodeIds.map(() => '?').join(',')
    const nodes = this.all(`SELECT * FROM graph_nodes WHERE id IN (${placeholders})`, nodeIds)
      .map(row => this.deserializeNode(row))
    const edges = this.all(
      `SELECT * FROM graph_edges WHERE from_id IN (${placeholders}) AND to_id IN (${placeholders})`,
      [...nodeIds, ...nodeIds]
    ).map(row => this.deserializeEdge(row))
    return { nodes, edges, paths: rows.map(row => String(row.path).split('|').filter(Boolean)) }
  }

  async syncGraph(nodes: TemporalNode<NodeData>[], edges: TemporalEdge<EdgeData>[]): Promise<void> {
    this.run('BEGIN')
    try {
      this.run('DELETE FROM graph_edges; DELETE FROM graph_nodes;')
      for (const node of nodes) await this.saveNode(node)
      for (const edge of edges) await this.saveEdge(edge)
      this.run('COMMIT')
    } catch (error) {
      this.run('ROLLBACK')
      throw error
    }
  }

  async close(): Promise<void> {
    if (!this.db) return
    if (this.dbFilename !== ':memory:') writeFileSync(this.dbFilename, this.db.export())
    this.db.close()
    this.db = undefined
  }

  private serializeEdge(edge: TemporalEdge<EdgeData>): Record<string, SqlValue> {
    return {
      $id: edge.id, $from: edge.from, $to: edge.to,
      $vs: edge.valid_start, $ve: edge.valid_end ?? null,
      $et: edge.event_time, $oa: edge.observed_at, $ia: edge.ingested_at,
      $rk: edge.relation_kind, $evidence: JSON.stringify(edge.evidence_refs),
      $event: edge.event_id ?? null, $cause: edge.causation_id ?? null,
      $correlation: edge.correlation_id ?? null, $trace: edge.trace_id ?? null,
      $span: edge.span_id ?? null, $data: edge.data === undefined ? null : JSON.stringify(edge.data)
    }
  }

  private deserializeNode(row: any): TemporalNode<NodeData> {
    return {
      id: String(row.id), data: JSON.parse(String(row.data_json)),
      valid_start: row.valid_start ?? undefined, valid_end: row.valid_end ?? undefined,
      event_time: row.event_time ?? undefined, observed_at: row.observed_at ?? undefined,
      ingested_at: row.ingested_at ?? undefined
    }
  }

  private deserializeEdge(row: any): TemporalEdge<EdgeData> {
    return {
      id: String(row.id), from: String(row.from_id), to: String(row.to_id),
      valid_start: Number(row.valid_start), valid_end: row.valid_end ?? undefined,
      event_time: Number(row.event_time), observed_at: Number(row.observed_at), ingested_at: Number(row.ingested_at),
      relation_kind: row.relation_kind, evidence_refs: JSON.parse(String(row.evidence_refs_json)),
      event_id: row.event_id ?? undefined, causation_id: row.causation_id ?? undefined,
      correlation_id: row.correlation_id ?? undefined, trace_id: row.trace_id ?? undefined,
      span_id: row.span_id ?? undefined, created_at: Number(row.ingested_at),
      activated_at: Number(row.valid_start), deactivated_at: row.valid_end ?? undefined,
      data: row.data_json === null ? undefined : JSON.parse(String(row.data_json))
    }
  }
}
