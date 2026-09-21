# @purecore/temporal-graph-zig

> High-performance, zero-dependency native **Zig (v0.16)** temporal graph engine featuring $\mathcal{O}(n \log n)$ interval sweep-line algorithms, deterministic memory management, and real-time temporal network analytics.

[![Zig Version](https://img.shields.io/badge/zig-0.16.0-orange.svg)](https://ziglang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/suissa/purecore-semtempo-graphrag/actions/workflows/ci.yml/badge.svg)](https://github.com/suissa/purecore-semtempo-graphrag/actions)

---

## Overview

`@purecore/temporal-graph-zig` is a systems-level implementation of temporal interval graphs designed for **GraphRAG**, knowledge retrieval over time-evolving networks, conversational memory analytics, and high-frequency event streaming.

Unlike static graphs or snapshot-based temporal representations, this engine models relationships as half-open temporal intervals $[t_{\text{start}}, t_{\text{end}})$ with open-ended edge support and provides sub-quadratic algorithms for interval intersection and topological metrics.

### Key Highlights

- ⚡ **$\mathcal{O}(n \log n)$ Sweep-Line Algorithms**: Fast edge overlap counting and temporal overlap ratio using two-pointer coordinate sweep.
- 🛡️ **Guaranteed Memory Safety**: Zero leaks verified by `std.testing.allocator` across all test suites; explicit memory allocation via `std.mem.Allocator`.
- 🧭 **Strict Temporal Contract**: Rejects inverted or zero-duration intervals instead of silently rewriting evidence.
- 🔗 **Evidence-Gated Causality**: Causal edges require evidence or an explicit causation identifier; adjacency never implies causality.
- ⏱️ **Temporal Metrics Suite**: Temporal density (3 modes), temporal acceleration, normalized alive ratio, node lifespan, and interaction velocity.
- 📉 **Exponential Decay Pruning**: Configurable temporal half-life and access-count boosting for recency-aware memory eviction.
- 📦 **Zero External Dependencies**: Self-contained standard library implementation compatible with Zig 0.16.0.

---

## Features & Algorithmic Complexity

| Feature / Metric | Complexity (Time / Space) | Description |
| :--- | :--- | :--- |
| `edgeOverlapCountFast` | $\mathcal{O}(n \log n)$ / $\mathcal{O}(n)$ | Counts overlapping edge interval pairs via sorted start/end sweep-line |
| `temporalOverlapRatioFast` | $\mathcal{O}(n \log n)$ / $\mathcal{O}(n)$ | Normalized ratio of overlapping pairs in window $[t_0, t_1]$ |
| `edgeOverlapCountQuadratic` | $\mathcal{O}(n^2)$ / $\mathcal{O}(1)$ | Reference pairwise comparison for validation and benchmarking |
| `temporalDensity` | $\mathcal{O}(E)$ / $\mathcal{O}(V^2)$ (pairs)<br>$\mathcal{O}(E)$ / $\mathcal{O}(1)$ (time, raw) | Density over window $[t_0, t_1]$ across `.pairs`, `.time`, or `.raw` modes |
| `temporalAcceleration` | $\mathcal{O}(E)$ / $\mathcal{O}(1)$ | Activation rate shift between first and second half of time window |
| `graphAliveRatio` | $\mathcal{O}(E)$ / $\mathcal{O}(1)$ | Ratio of active interval presence (supports normalization in $[0.0, 1.0]$) |
| `nodeLifespan` | $\mathcal{O}(E)$ / $\mathcal{O}(1)$ | Active lifespan of a node with `deactivated_at`, `now` fallback, and isolated node handling |
| `nodeTemporalDegree` | $\mathcal{O}(E)$ / $\mathcal{O}(1)$ | Active connection count of a node within interval $[t_0, t_1]$ |
| `interactionVelocity` | $\mathcal{O}(E)$ / $\mathcal{O}(1)$ | Rate of newly activated edges per minute |
| `exponentialDecay` | $\mathcal{O}(1)$ / $\mathcal{O}(1)$ | Weight decay: $S(e, t) = w \cdot e^{-\lambda \Delta t} + \text{boost}$ |

---

## Getting Started

### Prerequisites

- [Zig](https://ziglang.org/download/) `0.16.0` or higher.

### Adding to Your Project

Add `@purecore/temporal-graph-zig` as a dependency in your `build.zig.zon`:

```zig
.{
    .name = .my_project,
    .version = "0.1.0",
    .fingerprint = 0x123456789abcdef0,
    .dependencies = .{
        .temporal_graph = .{
            .path = "../path/to/packages/temporal-graph-zig",
        },
    },
    .paths = .{""},
}
```

Expose the module in your `build.zig`:

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const temporal_graph_dep = b.dependency("temporal_graph", .{
        .target = target,
        .optimize = optimize,
    });

    const exe = b.addExecutable(.{
        .name = "my_app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "temporal_graph", .module = temporal_graph_dep.module("temporal_graph") },
            },
        }),
    });

    b.installArtifact(exe);
}
```

---

## Usage Examples

### 1. Basic Graph Creation and Edge Addition

```zig
const std = @import("std");
const tg = @import("temporal_graph");

pub fn main() !void {
    const allocator = std.heap.smp_allocator;

    var graph = tg.TemporalGraph.init(allocator);
    defer graph.deinit();

    // Explicitly add nodes (optional, edges auto-create missing nodes)
    try graph.addNode("user:101", "Alice");
    try graph.addNode("user:102", "Bob");

    // Add interval temporal edges: from, to, activated_at, deactivated_at, weight
    try graph.addEdge("user:101", "user:102", 1_000, 5_000, 1.0);
    try graph.addEdge("user:102", "user:103", 4_000, 8_000, 1.2);
    
    // Open-ended edge (deactivated_at = null, active indefinitely)
    try graph.addEdge("user:101", "user:103", 7_000, null, 1.5);

    std.debug.print("Nodes: {d}, Edges: {d}\n", .{ graph.getNodeCount(), graph.getEdgeCount() });
}
```

### 2. Querying Active Edges

```zig
// Query edges active at a specific instant (e.g., t = 4500)
const active_edges = try graph.getActiveEdgesAt(4_500, allocator);
defer allocator.free(active_edges);

for (active_edges) |edge| {
    std.debug.print("Active: {s} -> {s} (weight: {d:.2})\n", .{ edge.from, edge.to, edge.weight });
}

// Query edges active during interval [2000, 6000]
const interval_edges = try graph.getActiveEdgesInInterval(2_000, 6_000, allocator);
defer allocator.free(interval_edges);
```

### 3. High-Performance Sweep-Line Overlap ($\mathcal{O}(n \log n)$)

The sweep-line algorithm projects active intervals onto sorted arrays of start and end points, counting disjoint pairs in linear time after sorting:

```zig
// Fast O(n log n) overlap counting
const overlap_count = try tg.edgeOverlapCountFast(&graph, allocator);
std.debug.print("Total overlapping edge pairs: {d}\n", .{overlap_count});

// Normalized overlap ratio within window [t0, t1]
const overlap_ratio = try tg.temporalOverlapRatioFast(&graph, 1_000, 8_000, allocator);
std.debug.print("Overlap ratio in [1000, 8000]: {d:.4}\n", .{overlap_ratio});
```

### 4. Temporal Density and Acceleration

```zig
// 1. Pairs mode: distinct (u, v) pairs over max possible n*(n-1), bounded in [0.0, 1.0]
const density_pairs = try tg.temporalDensity(&graph, 1_000, 8_000, .{ .mode = .pairs }, allocator);

// 2. Continuous time mode: integrated active time over max possible volume
const density_time = try tg.temporalDensity(&graph, 1_000, 8_000, .{ .mode = .time }, allocator);

// 3. Temporal acceleration: difference in activations between second half and first half
const accel = tg.temporalAcceleration(&graph, 1_000, 8_000, .{ .per_minute = true });
std.debug.print("Acceleration: {d:.2} activations/min^2\n", .{accel});
```

### 5. Node Lifespan and Pruning via Exponential Decay

```zig
// Node lifespan: total elapsed time between earliest activation and latest deactivation
const lifespan = tg.nodeLifespan(&graph, "user:101", .{ .now = 10_000 });
std.debug.print("Lifespan of user:101: {d}ms\n", .{lifespan});

// Pruning relevance score: decay with access boost
const edge = graph.edges.items[0];
const current_time: i64 = 15_000;
const lambda = 0.05; // Decay rate per day
const access_count: u32 = 12;
const boost_per_access = 0.1;

const relevance = tg.calculateRelevanceScore(edge, current_time, lambda, access_count, boost_per_access);
std.debug.print("Relevance score: {d:.4}\n", .{relevance});
```

---

## API Reference

### Core Types

#### `Node`
```zig
pub const Node = struct {
    id: []const u8,
    data: ?[]const u8 = null,
};
```

#### `TemporalEdge`
```zig
pub const TemporalEdge = struct {
    id: []const u8,
    from: []const u8,
    to: []const u8,
    activated_at: i64,
    deactivated_at: ?i64 = null,
    weight: f64 = 1.0,

    pub fn isEffectivelyActiveAt(self: TemporalEdge, t: i64) bool;
    pub fn isEffectivelyActiveInInterval(self: TemporalEdge, t0: i64, t1: i64) bool;
    pub fn getEffectiveStart(self: TemporalEdge) i64;
    pub fn getEffectiveEnd(self: TemporalEdge) ?i64;
};
```

#### `TemporalGraph`
```zig
pub const TemporalGraph = struct {
    allocator: std.mem.Allocator,
    nodes: std.StringHashMap(Node),
    edges: std.ArrayList(TemporalEdge),

    pub fn init(allocator: std.mem.Allocator) TemporalGraph;
    pub fn deinit(self: *TemporalGraph) void;
    pub fn addNode(self: *TemporalGraph, id: []const u8, data: ?[]const u8) !void;
    pub fn hasNode(self: *const TemporalGraph, id: []const u8) bool;
    pub fn getNodeCount(self: *const TemporalGraph) usize;
    pub fn getEdgeCount(self: *const TemporalGraph) usize;
    pub fn addEdge(self: *TemporalGraph, from: []const u8, to: []const u8, activated_at: i64, deactivated_at: ?i64, weight: f64) !void;
    pub fn getActiveEdgesAt(self: *const TemporalGraph, t: i64, alloc: std.mem.Allocator) ![]TemporalEdge;
    pub fn getActiveEdgesInInterval(self: *const TemporalGraph, t0: i64, t1: i64, alloc: std.mem.Allocator) ![]TemporalEdge;
};
```

### Metrics & Algorithms

- **`edgeOverlapCountFast(graph: *const TemporalGraph, alloc: Allocator) !usize`**  
  Computes total number of pairwise overlapping intervals in $\mathcal{O}(n \log n)$ time.
- **`temporalOverlapRatioFast(graph: *const TemporalGraph, t0: i64, t1: i64, alloc: Allocator) !f64`**  
  Computes normalized ratio of overlapping pairs in interval $[t_0, t_1]$ in $\mathcal{O}(n \log n)$ time.
- **`edgeOverlapCountQuadratic(graph: *const TemporalGraph) usize`**  
  Baseline pairwise intersection count ($\mathcal{O}(n^2)$).
- **`temporalDensity(graph: *const TemporalGraph, t0: i64, t1: i64, options: DensityOptions, alloc: Allocator) !f64`**  
  Density calculation with `.pairs`, `.time`, or `.raw` mode.
- **`temporalAcceleration(graph: *const TemporalGraph, t0: i64, t1: i64, options: AccelerationOptions) f64`**  
  Activation difference between $[t_{mid}, t_1]$ and $[t_0, t_{mid})$.
- **`graphAliveRatio(graph: *const TemporalGraph, t0: i64, t1: i64, normalize: bool) f64`**  
  Fraction of time interval edges remained active.
- **`nodeLifespan(graph: *const TemporalGraph, node_id: []const u8, options: NodeLifespanOptions) i64`**  
  Time span of activity for a given node.
- **`nodeTemporalDegree(graph: *const TemporalGraph, node_id: []const u8, t0: i64, t1: i64) usize`**  
  Number of active connections for a node within $[t_0, t_1]$.
- **`interactionVelocity(graph: *const TemporalGraph, t0: i64, t1: i64) f64`**  
  Activations per minute within window.

### Pruning Functions

- **`exponentialDecay(initial_weight: f64, delta_t_ms: f64, lambda: f64, access_boost: f64) f64`**  
  Decays weight over elapsed time:
  $$\text{score} = w \cdot e^{-\lambda \cdot (\Delta t_{\text{ms}} / 86{,}400{,}000)} + \text{boost}$$
- **`calculateRelevanceScore(edge: TemporalEdge, current_time: i64, lambda: f64, access_count: u32, boost_per_access: f64) f64`**  
  Calculates relevance of an edge based on age and access history.

---

## Build & Test Commands

```bash
# Run all unit tests (checks for 100% memory leak safety)
zig build test --summary all

# Run the CLI demonstration
zig build run

# Build release artifacts (optimized for maximum speed)
zig build -Doptimize=ReleaseFast
```

---

## License

MIT © [PureCore Team / Jean Carlo Nascimento](https://github.com/suissa)
