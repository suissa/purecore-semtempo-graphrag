const std = @import("std");
const Allocator = std.mem.Allocator;

pub const RelationKind = enum { adjacency, causal, semantic, behavioral, observational };

pub const EdgeOptions = struct {
    relation_kind: RelationKind = .adjacency,
    evidence_count: usize = 0,
    has_causation_id: bool = false,
    event_time: ?i64 = null,
    observed_at: ?i64 = null,
    ingested_at: ?i64 = null,
};

pub const Node = struct {
    id: []const u8,
    data: ?[]const u8 = null,
};

/// Canonical half-open valid-time edge: valid_start <= t < valid_end.
pub const TemporalEdge = struct {
    id: []const u8,
    from: []const u8,
    to: []const u8,
    valid_start: i64,
    valid_end: ?i64 = null,
    event_time: i64,
    observed_at: i64,
    ingested_at: i64,
    relation_kind: RelationKind = .adjacency,
    evidence_count: usize = 0,
    weight: f64 = 1.0,

    pub fn isEffectivelyActiveAt(self: TemporalEdge, t: i64) bool {
        return t >= self.valid_start and t < (self.valid_end orelse std.math.maxInt(i64));
    }

    pub fn isEffectivelyActiveInInterval(self: TemporalEdge, t0: i64, t1: i64) bool {
        if (t1 <= t0) return false;
        return self.valid_start < t1 and t0 < (self.valid_end orelse std.math.maxInt(i64));
    }

    pub fn getEffectiveEnd(self: TemporalEdge) ?i64 { return self.valid_end; }
    pub fn getEffectiveStart(self: TemporalEdge) i64 { return self.valid_start; }
    pub fn isCanonicalEvidence(self: TemporalEdge) bool {
        return self.relation_kind == .causal or self.evidence_count > 0;
    }
};

pub const TemporalGraph = struct {
    allocator: Allocator,
    nodes: std.StringHashMap(Node),
    edges: std.ArrayList(TemporalEdge),

    pub fn init(allocator: Allocator) TemporalGraph {
        return .{
            .allocator = allocator,
            .nodes = std.StringHashMap(Node).init(allocator),
            .edges = std.ArrayList(TemporalEdge).empty,
        };
    }

    pub fn deinit(self: *TemporalGraph) void {
        var it = self.nodes.iterator();
        while (it.next()) |entry| {
            self.allocator.free(entry.key_ptr.*);
            if (entry.value_ptr.data) |d| self.allocator.free(d);
        }
        self.nodes.deinit();
        for (self.edges.items) |edge| {
            self.allocator.free(edge.id);
            self.allocator.free(edge.from);
            self.allocator.free(edge.to);
        }
        self.edges.deinit(self.allocator);
    }

    pub fn addNode(self: *TemporalGraph, id: []const u8, data: ?[]const u8) !void {
        if (self.nodes.contains(id)) return error.NodeAlreadyExists;
        const id_copy = try self.allocator.dupe(u8, id);
        errdefer self.allocator.free(id_copy);
        const data_copy = if (data) |d| try self.allocator.dupe(u8, d) else null;
        errdefer if (data_copy) |d| self.allocator.free(d);
        try self.nodes.put(id_copy, .{ .id = id_copy, .data = data_copy });
    }

    pub fn hasNode(self: *const TemporalGraph, id: []const u8) bool { return self.nodes.contains(id); }
    pub fn getNodeCount(self: *const TemporalGraph) usize { return self.nodes.count(); }
    pub fn getEdgeCount(self: *const TemporalGraph) usize { return self.edges.items.len; }

    pub fn addEdge(
        self: *TemporalGraph,
        from: []const u8,
        to: []const u8,
        valid_start: i64,
        valid_end: ?i64,
        weight: f64,
    ) !void {
        return self.addEdgeWithOptions(from, to, valid_start, valid_end, weight, .{});
    }

    pub fn addEdgeWithOptions(
        self: *TemporalGraph,
        from: []const u8,
        to: []const u8,
        valid_start: i64,
        valid_end: ?i64,
        weight: f64,
        options: EdgeOptions,
    ) !void {
        if (!self.hasNode(from) or !self.hasNode(to)) return error.NodeDoesntExist;
        if (valid_end) |end| {
            if (end <= valid_start) return error.InvalidTemporalInterval;
        }
        if (options.relation_kind == .causal and options.evidence_count == 0 and !options.has_causation_id) {
            return error.CausalEvidenceRequired;
        }

        const edge_id = try std.fmt.allocPrint(self.allocator, "{s}->{s}@{d}:{s}", .{
            from, to, valid_start, @tagName(options.relation_kind),
        });
        errdefer self.allocator.free(edge_id);
        for (self.edges.items) |edge| {
            if (std.mem.eql(u8, edge.id, edge_id)) return error.EdgeAlreadyExists;
        }

        const from_copy = try self.allocator.dupe(u8, from);
        errdefer self.allocator.free(from_copy);
        const to_copy = try self.allocator.dupe(u8, to);
        errdefer self.allocator.free(to_copy);
        try self.edges.append(self.allocator, .{
            .id = edge_id,
            .from = from_copy,
            .to = to_copy,
            .valid_start = valid_start,
            .valid_end = valid_end,
            .event_time = options.event_time orelse valid_start,
            .observed_at = options.observed_at orelse valid_start,
            .ingested_at = options.ingested_at orelse valid_start,
            .relation_kind = options.relation_kind,
            .evidence_count = options.evidence_count,
            .weight = weight,
        });
    }

    pub fn getActiveEdgesAt(self: *const TemporalGraph, t: i64, alloc: Allocator) ![]TemporalEdge {
        var list: std.ArrayList(TemporalEdge) = .empty;
        errdefer list.deinit(alloc);
        for (self.edges.items) |edge| if (edge.isEffectivelyActiveAt(t)) try list.append(alloc, edge);
        return try list.toOwnedSlice(alloc);
    }

    pub fn getActiveEdgesInInterval(self: *const TemporalGraph, t0: i64, t1: i64, alloc: Allocator) ![]TemporalEdge {
        var list: std.ArrayList(TemporalEdge) = .empty;
        errdefer list.deinit(alloc);
        if (t1 <= t0) return try list.toOwnedSlice(alloc);
        for (self.edges.items) |edge| if (edge.isEffectivelyActiveInInterval(t0, t1)) try list.append(alloc, edge);
        return try list.toOwnedSlice(alloc);
    }
};
