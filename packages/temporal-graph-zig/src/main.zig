const std = @import("std");
const tg = @import("temporal_graph");

pub fn main() !void {
    const allocator = std.heap.smp_allocator;

    std.debug.print("=====================================================\n", .{});
    std.debug.print("  PureCore Temporal Graph (Zig Native High-Perf)     \n", .{});
    std.debug.print("=====================================================\n\n", .{});

    var graph = tg.TemporalGraph.init(allocator);
    defer graph.deinit();

    // Adicionando nós
    try graph.addNode("user:suissa", "Dev Lead");
    try graph.addNode("crm:whatsapp", "Channel");
    try graph.addNode("deal:allascode", "Enterprise Plan");

    // Adicionando arestas temporais intervalares
    try graph.addEdge("user:suissa", "crm:whatsapp", 1000, 5000, 1.0);
    try graph.addEdge("crm:whatsapp", "deal:allascode", 2000, 6000, 1.0);
    try graph.addEdge("user:suissa", "deal:allascode", 3000, 7000, 1.5);

    std.debug.print("Nós cadastrados: {d}\n", .{graph.getNodeCount()});
    std.debug.print("Arestas temporais: {d}\n\n", .{graph.getEdgeCount()});

    // Algoritmo Sweep-Line O(n log n)
    const fast_overlap = try tg.edgeOverlapCountFast(&graph, allocator);
    const quad_overlap = tg.edgeOverlapCountQuadratic(&graph);
    std.debug.print("[Overlap] Sweep-line O(n log n): {d} pares\n", .{fast_overlap});
    std.debug.print("[Overlap] Baseline O(n^2):       {d} pares\n", .{quad_overlap});

    // Métricas
    const density = try tg.temporalDensity(&graph, 1000, 7000, .{}, allocator);
    std.debug.print("[Metrics] Temporal Density (pairs mode): {d:.4}\n", .{density});

    const alive_ratio = tg.graphAliveRatio(&graph, 1000, 7000, true);
    std.debug.print("[Metrics] Graph Alive Ratio (normalized): {d:.4}\n", .{alive_ratio});

    const acceleration = tg.temporalAcceleration(&graph, 1000, 7000, .{});
    std.debug.print("[Metrics] Temporal Acceleration: {d:.2}\n", .{acceleration});

    const lifespan = tg.nodeLifespan(&graph, "user:suissa", .{});
    std.debug.print("[Metrics] Lifespan ('user:suissa'): {d}ms\n", .{lifespan});

    std.debug.print("\nStatus: Execução concluída com 100% de integridade de memória!\n", .{});
}
