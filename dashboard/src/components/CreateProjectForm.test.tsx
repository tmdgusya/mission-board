import { test, expect, describe } from "bun:test";

describe("CreateProjectForm", () => {
  test("module exports CreateProjectForm component", async () => {
    const mod = await import("./CreateProjectForm");
    expect(mod.CreateProjectForm).toBeDefined();
    expect(typeof mod.CreateProjectForm).toBe("function");
  });
});
