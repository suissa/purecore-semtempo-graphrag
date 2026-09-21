const std = @import("std");
const testing = std.testing;
const tg = @import("temporal_graph");

fn addNodes(graph: *tg.TemporalGraph, ids: []const []const u8) !void {
    for (ids) |id| try graph.addNode(id, null);
}

test "TemporalGraph - add nodes and temporal edges" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();

    try graph.addNode("A", "Data A");
    try graph.addNode("B", "Data B");

    try testing.expect(graph.hasNode("A"));
    try testing.expect(graph.hasNode("B"));
    try testing.expect(!graph.hasNode("C"));
    try testing.expectEqual(@as(usize, 2), graph.getNodeCount());

    // Nó duplicado deve retornar erro
    try testing.expectError(error.NodeAlreadyExists, graph.addNode("A", null));

    // Adiciona aresta temporal
    try graph.addEdge("A", "B", 1000, 5000, 1.0);
    try testing.expectEqual(@as(usize, 1), graph.getEdgeCount());

    // As implementações TS e Zig rejeitam arestas com nós ausentes.
    try graph.addNode("C", null);
    try graph.addEdge("B", "C", 2000, 6000, 1.0);
    try testing.expect(graph.hasNode("C"));
    try testing.expectEqual(@as(usize, 3), graph.getNodeCount());
    try testing.expectEqual(@as(usize, 2), graph.getEdgeCount());
}

test "TemporalGraph - active edges queries" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();
    try addNodes(&graph, &.{ "A", "B", "C", "D" });

    try graph.addEdge("A", "B", 1000, 5000, 1.0);
    try graph.addEdge("B", "C", 4000, 8000, 1.0);
    try graph.addEdge("C", "D", 7000, null, 1.0); // aresta aberta

    // Ativo em t = 500
    const edges_500 = try graph.getActiveEdgesAt(500, testing.allocator);
    defer testing.allocator.free(edges_500);
    try testing.expectEqual(@as(usize, 0), edges_500.len);

    // Ativo em t = 2000 (apenas A->B)
    const edges_2000 = try graph.getActiveEdgesAt(2000, testing.allocator);
    defer testing.allocator.free(edges_2000);
    try testing.expectEqual(@as(usize, 1), edges_2000.len);

    // Ativo em t = 4500 (A->B e B->C)
    const edges_4500 = try graph.getActiveEdgesAt(4500, testing.allocator);
    defer testing.allocator.free(edges_4500);
    try testing.expectEqual(@as(usize, 2), edges_4500.len);

    // Ativo em t = 10000 (apenas C->D aberta)
    const edges_10000 = try graph.getActiveEdgesAt(10000, testing.allocator);
    defer testing.allocator.free(edges_10000);
    try testing.expectEqual(@as(usize, 1), edges_10000.len);

    // Intervalo [1500, 4500] (ambas A->B e B->C)
    const interval_edges = try graph.getActiveEdgesInInterval(1500, 4500, testing.allocator);
    defer testing.allocator.free(interval_edges);
    try testing.expectEqual(@as(usize, 2), interval_edges.len);
}

test "Sweep-Line O(n log n) vs Quadratic O(n^2) overlap algorithm" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();
    try addNodes(&graph, &.{ "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12" });

    // Grafo vazio
    try testing.expectEqual(@as(usize, 0), try tg.edgeOverlapCountFast(&graph, testing.allocator));
    try testing.expectEqual(@as(usize, 0), tg.edgeOverlapCountQuadratic(&graph));

    // Apenas 1 aresta
    try graph.addEdge("1", "2", 100, 200, 1.0);
    try testing.expectEqual(@as(usize, 0), try tg.edgeOverlapCountFast(&graph, testing.allocator));
    try testing.expectEqual(@as(usize, 0), tg.edgeOverlapCountQuadratic(&graph));

    // Arestas não sobrepostas
    try graph.addEdge("3", "4", 300, 400, 1.0);
    try graph.addEdge("5", "6", 500, 600, 1.0);
    try testing.expectEqual(@as(usize, 0), try tg.edgeOverlapCountFast(&graph, testing.allocator));
    try testing.expectEqual(@as(usize, 0), tg.edgeOverlapCountQuadratic(&graph));

    // Arestas sobrepostas [100, 200], [300, 400], [500, 600] + nova [150, 350]
    // [150, 350] sobrepõe com [100, 200] e com [300, 400] -> 2 pares
    try graph.addEdge("7", "8", 150, 350, 1.0);
    const fast1 = try tg.edgeOverlapCountFast(&graph, testing.allocator);
    const quad1 = tg.edgeOverlapCountQuadratic(&graph);
    try testing.expectEqual(@as(usize, 2), fast1);
    try testing.expectEqual(quad1, fast1);

    // Adiciona aresta aberta [250, null]
    // [250, null] sobrepõe com [300, 400], [500, 600] e [150, 350] -> +3 pares -> total 5
    try graph.addEdge("9", "10", 250, null, 1.0);
    const fast2 = try tg.edgeOverlapCountFast(&graph, testing.allocator);
    const quad2 = tg.edgeOverlapCountQuadratic(&graph);
    try testing.expectEqual(@as(usize, 5), fast2);
    try testing.expectEqual(quad2, fast2);

    // Em intervalos semiabertos, [600, 700) não sobrepõe [500, 600).
    try graph.addEdge("11", "12", 600, 700, 1.0);
    const fast3 = try tg.edgeOverlapCountFast(&graph, testing.allocator);
    const quad3 = tg.edgeOverlapCountQuadratic(&graph);
    try testing.expectEqual(quad3, fast3);
}

test "Metrics - temporalDensity with modes and edge cases" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();

    // Edge case: janela vazia ou timestamps invertidos
    try testing.expectEqual(0.0, try tg.temporalDensity(&graph, 1000, 1000, .{}, testing.allocator));
    try testing.expectEqual(0.0, try tg.temporalDensity(&graph, 2000, 1000, .{}, testing.allocator));

    try graph.addNode("A", null);
    try graph.addNode("B", null);
    try graph.addNode("C", null);

    // max_edges = 3 * 2 = 6
    try graph.addEdge("A", "B", 100, 500, 1.0);
    try graph.addEdge("B", "C", 200, 600, 1.0);

    // Mode pairs: 2 pares únicos / 6 = 0.3333...
    const d_pairs = try tg.temporalDensity(&graph, 0, 1000, .{ .mode = .pairs }, testing.allocator);
    try testing.expectApproxEqAbs(2.0 / 6.0, d_pairs, 0.001);

    // Multigrafo entre A e B: não pode ultrapassar a contagem única de pares no modo pairs
    try graph.addEdge("A", "B", 150, 400, 1.0);
    const d_pairs_multi = try tg.temporalDensity(&graph, 0, 1000, .{ .mode = .pairs }, testing.allocator);
    try testing.expectApproxEqAbs(2.0 / 6.0, d_pairs_multi, 0.001);

    // Mode time
    const d_time = try tg.temporalDensity(&graph, 0, 1000, .{ .mode = .time }, testing.allocator);
    try testing.expect(d_time > 0.0 and d_time <= 1.0);
}

test "Metrics - temporalAcceleration and perMinute" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();
    try addNodes(&graph, &.{ "A", "B", "C", "D", "E" });

    // Janela vazia
    try testing.expectEqual(0.0, tg.temporalAcceleration(&graph, 1000, 1000, .{}));
    try testing.expectEqual(0.0, tg.temporalAcceleration(&graph, 2000, 1000, .{}));

    // [0, 1000], mid = 500
    // Primeira metade: 1 evento em 100
    // Segunda metade: 3 eventos em 600, 700, 800
    try graph.addEdge("A", "B", 100, 200, 1.0);
    try graph.addEdge("B", "C", 600, 700, 1.0);
    try graph.addEdge("C", "D", 700, 800, 1.0);
    try graph.addEdge("D", "E", 800, 900, 1.0);

    // diff = 3 - 1 = 2 (aceleração positiva)
    const acc = tg.temporalAcceleration(&graph, 0, 1000, .{});
    try testing.expectEqual(2.0, acc);

    // perMinute: janela = 1000ms = (1000 / 60000) min = 1/60 min
    // acc_per_min = 2.0 / (1/60) = 120.0
    const acc_per_min = tg.temporalAcceleration(&graph, 0, 1000, .{ .per_minute = true });
    try testing.expectApproxEqAbs(120.0, acc_per_min, 0.01);
}

test "Metrics - graphAliveRatio and edge cases" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();
    try addNodes(&graph, &.{ "A", "B", "C" });

    // Edge cases
    try testing.expectEqual(0.0, tg.graphAliveRatio(&graph, 1000, 1000, false));
    try testing.expectEqual(0.0, tg.graphAliveRatio(&graph, 2000, 1000, true));

    // Janela [0, 1000]
    try graph.addEdge("A", "B", 0, 1000, 1.0); // 1000ms ativo
    try graph.addEdge("B", "C", 0, 500, 1.0);  // 500ms ativo

    // Unnormalized: totalActive / duration = (1000 + 500) / 1000 = 1.5 arestas ativas concorrentes
    const alive_unnorm = tg.graphAliveRatio(&graph, 0, 1000, false);
    try testing.expectApproxEqAbs(1.5, alive_unnorm, 0.001);

    // Normalized: 1.5 / 2 arestas = 0.75
    const alive_norm = tg.graphAliveRatio(&graph, 0, 1000, true);
    try testing.expectApproxEqAbs(0.75, alive_norm, 0.001);
}

test "Metrics - nodeLifespan with deactivated_at, now, and isolated nodes" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();

    try graph.addNode("isolated", null);
    try addNodes(&graph, &.{ "user", "agent", "billing", "support" });
    try testing.expectEqual(@as(i64, 0), tg.nodeLifespan(&graph, "isolated", .{}));
    try testing.expectEqual(@as(i64, 0), tg.nodeLifespan(&graph, "nonexistent", .{}));

    try graph.addEdge("user", "agent", 1000, 4000, 1.0);
    try graph.addEdge("user", "billing", 2000, 8000, 1.0);

    // user lifespan: min = 1000, max = 8000 -> 7000ms
    const lifespan = tg.nodeLifespan(&graph, "user", .{});
    try testing.expectEqual(@as(i64, 7000), lifespan);

    // Aresta aberta com now
    try graph.addEdge("user", "support", 5000, null, 1.0);
    const lifespan_now = tg.nodeLifespan(&graph, "user", .{ .now = 12000 });
    try testing.expectEqual(@as(i64, 11000), lifespan_now);
}

test "Temporal contract - rejects inverted intervals and unsupported causality" {
    var graph = tg.TemporalGraph.init(testing.allocator);
    defer graph.deinit();
    try addNodes(&graph, &.{ "event:A", "event:B" });

    try testing.expectError(
        error.InvalidTemporalInterval,
        graph.addEdge("event:A", "event:B", 20, 10, 1.0),
    );
    try testing.expectError(
        error.CausalEvidenceRequired,
        graph.addEdgeWithOptions("event:A", "event:B", 10, 20, 1.0, .{ .relation_kind = .causal }),
    );

    try graph.addEdgeWithOptions("event:A", "event:B", 10, 20, 1.0, .{
        .relation_kind = .causal,
        .evidence_count = 1,
        .observed_at = 12,
        .ingested_at = 14,
    });
    try testing.expect(graph.edges.items[0].isCanonicalEvidence());
    try testing.expect(graph.edges.items[0].isEffectivelyActiveAt(10));
    try testing.expect(!graph.edges.items[0].isEffectivelyActiveAt(20));
}

test "Pruning - exponential decay and relevance" {
    // Decaimento em t = 0
    const score0 = tg.exponentialDecay(10.0, 0.0, 0.1, 2.0);
    try testing.expectEqual(12.0, score0);

    // Decaimento com o passar do tempo deve diminuir
    const score_later = tg.exponentialDecay(10.0, 86400000.0, 0.1, 0.0);
    try testing.expect(score_later < 10.0);
}
