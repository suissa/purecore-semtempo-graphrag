const std = @import("std");
const Allocator = std.mem.Allocator;

pub const Node = struct {
    id: []const u8,
    data: ?[]const u8 = null,
};

pub const TemporalEdge = struct {
    id: []const u8,
    from: []const u8,
    to: []const u8,
    activated_at: i64,
    deactivated_at: ?i64 = null,
    weight: f64 = 1.0,

    pub fn isEffectivelyActiveAt(self: TemporalEdge, t: i64) bool {
        const start = if (self.deactivated_at) |d| @min(self.activated_at, d) else self.activated_at;
        const end = if (self.deactivated_at) |d| @max(self.activated_at, d) else std.math.maxInt(i64);
        return t >= start and t <= end;
    }

    pub fn isEffectivelyActiveInInterval(self: TemporalEdge, t0: i64, t1: i64) bool {
        if (t1 < t0) return false;
        const start = if (self.deactivated_at) |d| @min(self.activated_at, d) else self.activated_at;
        const end = if (self.deactivated_at) |d| @max(self.activated_at, d) else std.math.maxInt(i64);
        return start <= t1 and end >= t0;
    }

    pub fn getEffectiveEnd(self: TemporalEdge) ?i64 {
        if (self.deactivated_at) |d| {
            return @max(self.activated_at, d);
        }
        return null;
    }

    pub fn getEffectiveStart(self: TemporalEdge) i64 {
        if (self.deactivated_at) |d| {
            return @min(self.activated_at, d);
        }
        return self.activated_at;
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
            if (entry.value_ptr.data) |d| {
                self.allocator.free(d);
            }
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
        if (self.nodes.contains(id)) {
            return error.NodeAlreadyExists;
        }

        const id_copy = try self.allocator.dupe(u8, id);
        errdefer self.allocator.free(id_copy);

        const data_copy = if (data) |d| try self.allocator.dupe(u8, d) else null;
        errdefer if (data_copy) |d| self.allocator.free(d);

        try self.nodes.put(id_copy, .{
            .id = id_copy,
            .data = data_copy,
        });
    }

    pub fn hasNode(self: *const TemporalGraph, id: []const u8) bool {
        return self.nodes.contains(id);
    }

    pub fn getNodeCount(self: *const TemporalGraph) usize {
        return self.nodes.count();
    }

    pub fn getEdgeCount(self: *const TemporalGraph) usize {
        return self.edges.items.len;
    }

    pub fn addEdge(
        self: *TemporalGraph,
        from: []const u8,
        to: []const u8,
        activated_at: i64,
        deactivated_at: ?i64,
        weight: f64,
    ) !void {
        if (!self.hasNode(from)) {
            try self.addNode(from, null);
        }
        if (!self.hasNode(to)) {
            try self.addNode(to, null);
        }

        const edge_id = try std.fmt.allocPrint(self.allocator, "{s}->{s}@{d}", .{ from, to, activated_at });
        errdefer self.allocator.free(edge_id);

        const from_copy = try self.allocator.dupe(u8, from);
        errdefer self.allocator.free(from_copy);

        const to_copy = try self.allocator.dupe(u8, to);
        errdefer self.allocator.free(to_copy);

        try self.edges.append(self.allocator, .{
            .id = edge_id,
            .from = from_copy,
            .to = to_copy,
            .activated_at = activated_at,
            .deactivated_at = deactivated_at,
            .weight = weight,
        });
    }

    pub fn getActiveEdgesAt(self: *const TemporalGraph, t: i64, alloc: Allocator) ![]TemporalEdge {
        var list: std.ArrayList(TemporalEdge) = .empty;
        errdefer list.deinit(alloc);

        for (self.edges.items) |edge| {
            if (edge.isEffectivelyActiveAt(t)) {
                try list.append(alloc, edge);
            }
        }
        return try list.toOwnedSlice(alloc);
    }

    pub fn getActiveEdgesInInterval(self: *const TemporalGraph, t0: i64, t1: i64, alloc: Allocator) ![]TemporalEdge {
        var list: std.ArrayList(TemporalEdge) = .empty;
        errdefer list.deinit(alloc);

        if (t1 < t0) {
            return try list.toOwnedSlice(alloc);
        }

        for (self.edges.items) |edge| {
            if (edge.isEffectivelyActiveInInterval(t0, t1)) {
                try list.append(alloc, edge);
            }
        }
        return try list.toOwnedSlice(alloc);
    }
};
