const std = @import("std");
const Allocator = std.mem.Allocator;
const TemporalGraph = @import("graph.zig").TemporalGraph;
const TemporalEdge = @import("graph.zig").TemporalEdge;

pub const DensityMode = enum {
    pairs,
    time,
    raw,
};

pub const DensityOptions = struct {
    mode: DensityMode = .pairs,
};

pub const AccelerationOptions = struct {
    per_minute: bool = false,
};

pub const NodeLifespanOptions = struct {
    now: ?i64 = null,
};

/// Conta o número de pares de arestas sobrepostas usando algoritmo Sweep-Line em O(n log n).
pub fn edgeOverlapCountFast(graph: *const TemporalGraph, alloc: Allocator) !usize {
    const n = graph.edges.items.len;
    if (n <= 1) return 0;

    var starts = try alloc.alloc(i64, n);
    defer alloc.free(starts);

    var ends = try alloc.alloc(i64, n);
    defer alloc.free(ends);

    for (graph.edges.items, 0..) |edge, i| {
        starts[i] = edge.getEffectiveStart();
        ends[i] = edge.getEffectiveEnd() orelse std.math.maxInt(i64);
    }

    std.mem.sort(i64, starts, {}, std.sort.asc(i64));
    std.mem.sort(i64, ends, {}, std.sort.asc(i64));

    var disjoint_pairs: usize = 0;
    var end_idx: usize = 0;

    for (starts) |s| {
        while (end_idx < n and ends[end_idx] <= s) {
            end_idx += 1;
        }
        disjoint_pairs += end_idx;
    }

    const total_pairs = (n * (n - 1)) / 2;
    if (disjoint_pairs >= total_pairs) return 0;
    return total_pairs - disjoint_pairs;
}

/// Versão quadrática O(n^2) para validação e comparação
pub fn edgeOverlapCountQuadratic(graph: *const TemporalGraph) usize {
    const edges = graph.edges.items;
    const n = edges.len;
    if (n <= 1) return 0;

    var count: usize = 0;
    var i: usize = 0;
    while (i < n) : (i += 1) {
        const s1 = edges[i].getEffectiveStart();
        const e1 = edges[i].getEffectiveEnd() orelse std.math.maxInt(i64);

        var j: usize = i + 1;
        while (j < n) : (j += 1) {
            const s2 = edges[j].getEffectiveStart();
            const e2 = edges[j].getEffectiveEnd() orelse std.math.maxInt(i64);

            if (@max(s1, s2) < @min(e1, e2)) {
                count += 1;
            }
        }
    }
    return count;
}

/// Razão de sobreposição temporal de arestas em [t0, t1] em O(n log n).
pub fn temporalOverlapRatioFast(
    graph: *const TemporalGraph,
    t0: i64,
    t1: i64,
    alloc: Allocator,
) !f64 {
    if (t1 <= t0) return 0.0;

    var sub_starts: std.ArrayList(i64) = .empty;
    defer sub_starts.deinit(alloc);

    var sub_ends: std.ArrayList(i64) = .empty;
    defer sub_ends.deinit(alloc);

    for (graph.edges.items) |edge| {
        if (edge.isEffectivelyActiveInInterval(t0, t1)) {
            const s = @max(edge.getEffectiveStart(), t0);
            const raw_e = edge.getEffectiveEnd() orelse std.math.maxInt(i64);
            const e = @min(raw_e, t1);
            try sub_starts.append(alloc, s);
            try sub_ends.append(alloc, e);
        }
    }

    const k = sub_starts.items.len;
    if (k <= 1) return 0.0;

    const starts = sub_starts.items;
    const ends = sub_ends.items;

    std.mem.sort(i64, starts, {}, std.sort.asc(i64));
    std.mem.sort(i64, ends, {}, std.sort.asc(i64));

    var disjoint: usize = 0;
    var end_idx: usize = 0;

    for (starts) |s| {
        while (end_idx < k and ends[end_idx] <= s) {
            end_idx += 1;
        }
        disjoint += end_idx;
    }

    const total = (k * (k - 1)) / 2;
    if (disjoint >= total) return 0.0;
    const overlap = total - disjoint;

    return @as(f64, @floatFromInt(overlap)) / @as(f64, @floatFromInt(total));
}

/// Densidade temporal normalizada no intervalo [t0, t1].
pub fn temporalDensity(
    graph: *const TemporalGraph,
    t0: i64,
    t1: i64,
    options: DensityOptions,
    alloc: Allocator,
) !f64 {
    if (t1 <= t0) return 0.0;

    const n = graph.getNodeCount();
    if (n <= 1) return 0.0;

    const max_possible_edges = @as(f64, @floatFromInt(n * (n - 1)));

    switch (options.mode) {
        .pairs => {
            var active_pairs = std.StringHashMap(void).init(alloc);
            defer {
                var it = active_pairs.keyIterator();
                while (it.next()) |key_ptr| {
                    alloc.free(key_ptr.*);
                }
                active_pairs.deinit();
            }

            for (graph.edges.items) |edge| {
                if (std.mem.eql(u8, edge.from, edge.to)) continue; // ignora self-loop
                if (edge.isEffectivelyActiveInInterval(t0, t1)) {
                    const key = try std.fmt.allocPrint(alloc, "{s}->{s}", .{ edge.from, edge.to });
                    if (active_pairs.contains(key)) {
                        alloc.free(key);
                    } else {
                        try active_pairs.put(key, {});
                    }
                }
            }

            const active_count = @as(f64, @floatFromInt(active_pairs.count()));
            return @min(1.0, active_count / max_possible_edges);
        },
        .time => {
            var total_active: f64 = 0.0;
            for (graph.edges.items) |edge| {
                if (std.mem.eql(u8, edge.from, edge.to)) continue;
                if (edge.isEffectivelyActiveInInterval(t0, t1)) {
                    const s = @max(edge.getEffectiveStart(), t0);
                    const raw_e = edge.getEffectiveEnd() orelse std.math.maxInt(i64);
                    const e = @min(raw_e, t1);
                    if (e > s) {
                        total_active += @as(f64, @floatFromInt(e - s));
                    }
                }
            }
            const window_duration = @as(f64, @floatFromInt(t1 - t0));
            const denominator = max_possible_edges * window_duration;
            if (denominator <= 0.0) return 0.0;
            return @min(1.0, total_active / denominator);
        },
        .raw => {
            var active_edges: usize = 0;
            for (graph.edges.items) |edge| {
                if (std.mem.eql(u8, edge.from, edge.to)) continue;
                if (edge.isEffectivelyActiveInInterval(t0, t1)) {
                    active_edges += 1;
                }
            }
            return @as(f64, @floatFromInt(active_edges)) / max_possible_edges;
        },
    }
}

/// Aceleração temporal comparando a primeira e a segunda metade do intervalo [t0, t1].
pub fn temporalAcceleration(
    graph: *const TemporalGraph,
    t0: i64,
    t1: i64,
    options: AccelerationOptions,
) f64 {
    if (t1 <= t0) return 0.0;

    const mid = t0 + @divTrunc(t1 - t0, 2);

    var a0: f64 = 0.0;
    var a1: f64 = 0.0;

    for (graph.edges.items) |edge| {
        const start = edge.getEffectiveStart();
        if (start >= t0 and start < mid) {
            a0 += 1.0;
        }
        if (start >= mid and start < t1) {
            a1 += 1.0;
        }
    }

    const diff = a1 - a0;
    if (options.per_minute) {
        const duration_ms = @as(f64, @floatFromInt(t1 - t0));
        const duration_minutes = duration_ms / 60000.0;
        if (duration_minutes <= 0.0) return 0.0;
        return diff / duration_minutes;
    }

    return diff;
}

/// Proporção de tempo em que as arestas do grafo permaneceram ativas em [t0, t1].
pub fn graphAliveRatio(
    graph: *const TemporalGraph,
    t0: i64,
    t1: i64,
    normalize: bool,
) f64 {
    if (t1 <= t0) return 0.0;

    var total_active: f64 = 0.0;
    var edges_in_interval: usize = 0;

    for (graph.edges.items) |edge| {
        if (edge.isEffectivelyActiveInInterval(t0, t1)) {
            edges_in_interval += 1;
            const s = @max(edge.getEffectiveStart(), t0);
            const raw_e = edge.getEffectiveEnd() orelse std.math.maxInt(i64);
            const e = @min(raw_e, t1);
            if (e > s) {
                total_active += @as(f64, @floatFromInt(e - s));
            }
        }
    }

    const window_duration = @as(f64, @floatFromInt(t1 - t0));
    if (normalize) {
        if (edges_in_interval == 0) return 0.0;
        const total_possible = @as(f64, @floatFromInt(edges_in_interval)) * window_duration;
        return total_active / total_possible;
    }

    return total_active / window_duration;
}

/// Tempo de vida (lifespan) de um nó no grafo baseado em suas arestas ativas.
pub fn nodeLifespan(
    graph: *const TemporalGraph,
    node_id: []const u8,
    options: NodeLifespanOptions,
) i64 {
    if (!graph.hasNode(node_id)) return 0;

    var min_time: ?i64 = null;
    var max_time: ?i64 = null;

    for (graph.edges.items) |edge| {
        if (std.mem.eql(u8, edge.from, node_id) or std.mem.eql(u8, edge.to, node_id)) {
            const s = edge.getEffectiveStart();
            const e = edge.getEffectiveEnd() orelse (options.now orelse s);

            if (min_time == null or s < min_time.?) {
                min_time = s;
            }
            if (max_time == null or e > max_time.?) {
                max_time = e;
            }
        }
    }

    if (min_time == null or max_time == null) return 0;
    if (max_time.? < min_time.?) return 0;
    return max_time.? - min_time.?;
}

/// Grau temporal de um nó (número de conexões ativas) no intervalo [t0, t1].
pub fn nodeTemporalDegree(
    graph: *const TemporalGraph,
    node_id: []const u8,
    t0: i64,
    t1: i64,
) usize {
    if (t1 < t0) return 0;
    if (!graph.hasNode(node_id)) return 0;

    var degree: usize = 0;
    for (graph.edges.items) |edge| {
        if (std.mem.eql(u8, edge.from, node_id) or std.mem.eql(u8, edge.to, node_id)) {
            if (edge.isEffectivelyActiveInInterval(t0, t1)) {
                degree += 1;
            }
        }
    }
    return degree;
}

/// Velocidade de interação: novas arestas ativadas por minuto em [t0, t1].
pub fn interactionVelocity(graph: *const TemporalGraph, t0: i64, t1: i64) f64 {
    if (t1 <= t0) return 0.0;

    var activations: usize = 0;
    for (graph.edges.items) |edge| {
        const s = edge.getEffectiveStart();
        if (s >= t0 and s < t1) {
            activations += 1;
        }
    }

    const duration_min = @as(f64, @floatFromInt(t1 - t0)) / 60000.0;
    if (duration_min <= 0.0) return 0.0;
    return @as(f64, @floatFromInt(activations)) / duration_min;
}
