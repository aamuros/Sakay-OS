import { describe, expect, it } from "vitest";
import { runJeepneySimulation } from "./jeepneyScheduler";
import type { JeepneySimulationConfig } from "./types";

function createConfig(
  overrides: Partial<JeepneySimulationConfig> = {}
): JeepneySimulationConfig {
  return {
    route: {
      id: "jeepney-line",
      name: "Cubao Loop",
      stops: [
        { id: "stop-a", name: "Stop A" },
        { id: "stop-b", name: "Stop B" },
        { id: "stop-c", name: "Stop C" }
      ]
    },
    jeepneys: [
      { id: "j1", label: "J1" },
      { id: "j2", label: "J2" },
      { id: "j3", label: "J3" }
    ],
    ticks: 6,
    timeQuantum: 2,
    agingEnabled: false,
    ...overrides
  };
}

describe("runJeepneySimulation", () => {
  it("rotates jeepneys fairly with deterministic quantum expiration", () => {
    const result = runJeepneySimulation(createConfig());

    expect(result.events.map((event) => event.activeJeepneyId)).toEqual([
      "j1",
      "j1",
      "j2",
      "j2",
      "j3",
      "j3"
    ]);

    expect(result.events.map((event) => event.reason)).toEqual([
      "dispatch",
      "continue-quantum",
      "quantum-expired",
      "continue-quantum",
      "quantum-expired",
      "continue-quantum"
    ]);

    expect(result.metrics[1].contextSwitches).toBe(0);
    expect(result.metrics[2].contextSwitches).toBe(1);
    expect(result.metrics[4].contextSwitches).toBe(2);
  });

  it("applies aging boost to longest-waiting jeepney beyond threshold", () => {
    const result = runJeepneySimulation(
      createConfig({
        ticks: 4,
        timeQuantum: 1,
        agingEnabled: true,
        agingThreshold: 3,
        jeepneys: [
          { id: "j1", label: "J1", initialWaitTicks: 0 },
          { id: "j2", label: "J2", initialWaitTicks: 3 },
          { id: "j3", label: "J3", initialWaitTicks: 4 }
        ]
      })
    );

    expect(result.events[0]).toMatchObject({
      activeJeepneyId: "j3",
      reason: "aging-boost"
    });

    expect(result.jeepneys.j3.agingBoosts).toBe(1);
    expect(result.events.map((event) => event.activeJeepneyId)).toEqual([
      "j3",
      "j2",
      "j1",
      "j3"
    ]);
  });

  it("tracks wait time, throughput, starvation risk, and queue snapshots", () => {
    const result = runJeepneySimulation(
      createConfig({
        ticks: 3,
        jeepneys: [
          { id: "j1", label: "J1" },
          { id: "j2", label: "J2" }
        ],
        timeQuantum: 2,
        agingEnabled: false,
        agingThreshold: 2
      })
    );

    expect(result.metrics).toEqual([
      {
        tick: 0,
        activeJeepneyId: "j1",
        throughput: 1,
        totalWaitTime: 1,
        averageWaitTime: 0.5,
        contextSwitches: 0,
        starvationRisk: 0,
        queue: ["j2"]
      },
      {
        tick: 1,
        activeJeepneyId: "j1",
        throughput: 2,
        totalWaitTime: 2,
        averageWaitTime: 1,
        contextSwitches: 0,
        starvationRisk: 1,
        queue: ["j2"]
      },
      {
        tick: 2,
        activeJeepneyId: "j2",
        throughput: 3,
        totalWaitTime: 3,
        averageWaitTime: 1.5,
        contextSwitches: 1,
        starvationRisk: 0,
        queue: ["j1"]
      }
    ]);
  });

  it("returns final jeepney progress for pure input-to-output simulation", () => {
    const result = runJeepneySimulation(createConfig());

    expect(result.jeepneys).toMatchObject({
      j1: {
        completedStops: 2,
        nextStopIndex: 2
      },
      j2: {
        completedStops: 2,
        nextStopIndex: 2
      },
      j3: {
        completedStops: 2,
        nextStopIndex: 2
      }
    });
  });
});
