# @purecore/temporal-graph-zig

> Motor de grafo temporal nativo em **Zig (v0.16)** de altíssima performance, zero dependências externas e gerenciamento manual de memória com segurança determinística.

## 🚀 Funcionalidades

- **Estruturas de Dados**:
  - `Node`: representação de nós com identificador e payload opcional.
  - `TemporalEdge`: arestas intervalares `[activated_at, deactivated_at]` com normalização automática para timestamps invertidos e suporte a arestas abertas.
  - `TemporalGraph`: grafo temporal com alocador genérico (`std.mem.Allocator`).
- **Algoritmos & Métricas O(n log n)**:
  - `edgeOverlapCountFast`: algoritmo sweep-line two-pointer que conta pares sobrepostos em $O(n \log n)$ tempo e $O(n)$ espaço.
  - `temporalOverlapRatioFast`: razão normalizada de sobreposição em janelas temporais.
  - `temporalDensity`: modos `pairs` (pares únicos $(u, v)$ em $[0, 1]$ com proteção a multigrafos), `time` (espaço-temporal contínuo) e `raw`.
  - `temporalAcceleration`: variação de eventos entre metades de janela com opção `per_minute`.
  - `graphAliveRatio`: razão de atividade normalizada ou concorrência ativa.
  - `nodeLifespan`: tempo de vida com suporte a `deactivated_at`, timestamp de referência `now` e nós isolados.
  - `nodeTemporalDegree`: grau temporal de um nó em uma janela.
  - `interactionVelocity`: velocidade de ativação por minuto.
- **Poda & Decaimento Exponencial**:
  - `exponentialDecay`: $S(e, t) = w \cdot e^{-\lambda \Delta t} + \text{boost}$
  - `calculateRelevanceScore`: relevância ponderada por tempo e histórico de acessos.

## 🛠️ Compilação e Testes

```bash
# Executar todos os testes unitários
zig build test

# Executar a CLI de demonstração
zig build run
```

## 📦 Uso como Módulo Zig

Em seu `build.zig.zon`:
```zig
.{
    .dependencies = .{
        .temporal_graph = .{
            .path = "../temporal-graph-zig",
        },
    },
}
```

No código:
```zig
const std = @import("std");
const tg = @import("temporal_graph");

pub fn main() !void {
    const allocator = std.heap.smp_allocator;
    var graph = tg.TemporalGraph.init(allocator);
    defer graph.deinit();

    try graph.addEdge("A", "B", 1000, 5000, 1.0);
    try graph.addEdge("B", "C", 2000, 6000, 1.0);

    const overlap = try tg.edgeOverlapCountFast(&graph, allocator);
    std.debug.print("Overlap count: {d}\n", .{overlap});
}
```
