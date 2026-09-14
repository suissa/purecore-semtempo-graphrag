const std = @import("std");
const TemporalGraph = @import("graph.zig").TemporalGraph;
const TemporalEdge = @import("graph.zig").TemporalEdge;

/// Calcula decaimento exponencial: S(e, t) = weight * exp(-lambda * delta_days) + access_boost
pub fn exponentialDecay(
    initial_weight: f64,
    delta_t_ms: f64,
    lambda: f64,
    access_boost: f64,
) f64 {
    if (delta_t_ms <= 0.0) {
        return initial_weight + access_boost;
    }
    const delta_days = delta_t_ms / 86400000.0; // converte ms para dias
    const decay_factor = @exp(-lambda * delta_days);
    return (initial_weight * decay_factor) + access_boost;
}

/// Pontuação de relevância temporal de uma aresta
pub fn calculateRelevanceScore(
    edge: TemporalEdge,
    current_time: i64,
    lambda: f64,
    access_count: u32,
    boost_per_access: f64,
) f64 {
    const end = edge.getEffectiveEnd() orelse current_time;
    const delta_t = @as(f64, @floatFromInt(@max(0, current_time - end)));
    const boost = @as(f64, @floatFromInt(access_count)) * boost_per_access;
    return exponentialDecay(edge.weight, delta_t, lambda, boost);
}
