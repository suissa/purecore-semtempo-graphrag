const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Módulo principal
    const mod = b.addModule("temporal_graph", .{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
    });

    // Biblioteca estática
    const lib = b.addLibrary(.{
        .name = "temporal_graph",
        .root_module = mod,
    });
    b.installArtifact(lib);

    // Executável CLI de demonstração
    const exe = b.addExecutable(.{
        .name = "temporal-graph-cli",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "temporal_graph", .module = mod },
            },
        }),
    });
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run the CLI demonstration");
    run_step.dependOn(&run_cmd.step);

    // Step de testes unitários
    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("test/temporal_graph_test.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "temporal_graph", .module = mod },
            },
        }),
    });
    const run_tests = b.addRunArtifact(tests);

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_tests.step);
}
