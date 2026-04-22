import { describe, expect, it } from "vitest";
import { scenarios } from "./scenarios";

describe("scenario scaffold", () => {
  it("keeps Jeepney Bunching as the first active scenario", () => {
    expect(scenarios).toHaveLength(3);
    expect(scenarios[0]).toMatchObject({
      id: "jeepney-bunching",
      status: "active",
      algorithm: "Round Robin + Aging"
    });
  });

  it("marks the non-jeepney scenarios as in progress", () => {
    expect(scenarios.slice(1)).toEqual([
      expect.objectContaining({
        id: "edsa-overload",
        status: "in-progress"
      }),
      expect.objectContaining({
        id: "mrt-breakdown",
        status: "in-progress"
      })
    ]);
  });

  it("registers pluggable stage components for every scenario", () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "jeepney-bunching",
      "edsa-overload",
      "mrt-breakdown"
    ]);

    scenarios.forEach((scenario) => {
      expect(typeof scenario.Stage).toBe("function");
    });
  });
});
