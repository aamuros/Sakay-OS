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

  it("uses the default aging threshold when aging is enabled without an override", () => {
    const result = runJeepneySimulation(
      createConfig({
        ticks: 3,
        timeQuantum: 1,
        agingEnabled: true,
        agingThreshold: undefined
      })
    );

    expect(result.events[2]).toMatchObject({
      activeJeepneyId: "j3",
      reason: "quantum-expired",
      activeWaitTicks: 2
    });
    expect(result.metrics[1].atRiskJeepneyIds).toEqual(["j3"]);
    expect(result.jeepneys.j3.agingBoosts).toBe(0);
  });

  it("does not count aging when the front jeepney would dispatch normally", () => {
    const result = runJeepneySimulation(
      createConfig({
        ticks: 3,
        timeQuantum: 2,
        agingEnabled: true,
        agingThreshold: 1,
        jeepneys: [
          { id: "j1", label: "J1" },
          { id: "j2", label: "J2" }
        ]
      })
    );

    expect(result.events.map((event) => event.activeJeepneyId)).toEqual([
      "j1",
      "j1",
      "j2"
    ]);
    expect(result.events.map((event) => event.reason)).toEqual([
      "dispatch",
      "continue-quantum",
      "quantum-expired"
    ]);
    expect(result.metrics[0].atRiskJeepneyIds).toEqual(["j2"]);
    expect(result.jeepneys.j2.agingBoosts).toBe(0);
  });

  it("keeps FIFO order when multiple jeepneys tie for highest aging wait", () => {
    const result = runJeepneySimulation(
      createConfig({
        ticks: 1,
        timeQuantum: 1,
        agingEnabled: true,
        agingThreshold: 4,
        jeepneys: [
          { id: "j1", label: "J1", initialWaitTicks: 0 },
          { id: "j2", label: "J2", initialWaitTicks: 4 },
          { id: "j3", label: "J3", initialWaitTicks: 4 }
        ]
      })
    );

    expect(result.events[0]).toMatchObject({
      activeJeepneyId: "j2",
      reason: "aging-boost"
    });
    expect(result.jeepneys.j2.agingBoosts).toBe(1);
    expect(result.jeepneys.j3.agingBoosts).toBe(0);
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
      expect.objectContaining({
        tick: 0,
        activeJeepneyId: "j1",
        throughput: 1,
        totalWaitTime: 1,
        averageWaitTime: 1,
        contextSwitches: 0,
        starvationRisk: 0,
        queue: ["j2"],
        atRiskJeepneyIds: [],
        waitByJeepneyId: {
          j1: 0,
          j2: 1
        },
        bunchingScore: 1,
        bunchedStopIds: ["stop-a"],
        maxBunchSize: 2
      }),
      expect.objectContaining({
        tick: 1,
        activeJeepneyId: "j1",
        throughput: 2,
        totalWaitTime: 2,
        averageWaitTime: 2,
        contextSwitches: 0,
        starvationRisk: 1,
        queue: ["j2"],
        atRiskJeepneyIds: ["j2"],
        waitByJeepneyId: {
          j1: 0,
          j2: 2
        },
        bunchingScore: 0,
        bunchedStopIds: [],
        maxBunchSize: 0
      }),
      expect.objectContaining({
        tick: 2,
        activeJeepneyId: "j2",
        throughput: 3,
        totalWaitTime: 3,
        averageWaitTime: 1,
        contextSwitches: 1,
        starvationRisk: 0,
        queue: ["j1"],
        atRiskJeepneyIds: [],
        waitByJeepneyId: {
          j1: 1,
          j2: 0
        },
        bunchingScore: 0,
        bunchedStopIds: [],
        maxBunchSize: 0
      })
    ]);
  });

  it("uses passenger arrival pressure to accelerate wait risk and backlog snapshots", () => {
    const result = runJeepneySimulation(
      createConfig({
        ticks: 4,
        timeQuantum: 1,
        agingEnabled: true,
        agingThreshold: 3,
        passengerArrivalRate: 5,
        passengerBoardingRate: 2
      })
    );

    expect(result.events[0]).toMatchObject({
      activeJeepneyId: "j1",
      servedPassengers: 2,
      passengerBacklog: 14
    });
    expect(result.events[1]).toMatchObject({
      activeJeepneyId: "j2",
      reason: "quantum-expired",
      didContextSwitch: true
    });
    expect(result.metrics[0]).toMatchObject({
      waitByJeepneyId: {
        j1: 0,
        j2: 3,
        j3: 3
      },
      passengerBacklog: 14
    });
    expect(result.metrics[1].busiestStopId).toBeTruthy();
  });

  it("reports bunching when multiple jeepneys stack at the same stop", () => {
    const result = runJeepneySimulation(
      createConfig({
        ticks: 2,
        timeQuantum: 1,
        jeepneys: [
          { id: "j1", label: "J1", initialStopIndex: 0 },
          { id: "j2", label: "J2", initialStopIndex: 0 },
          { id: "j3", label: "J3", initialStopIndex: 2 }
        ]
      })
    );

    expect(result.metrics[0]).toMatchObject({
      bunchingScore: 1,
      bunchedStopIds: ["stop-a"],
      maxBunchSize: 2
    });

    expect(result.metrics[1]).toMatchObject({
      bunchingScore: 0,
      bunchedStopIds: [],
      maxBunchSize: 0
    });
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

  it("rejects invalid simulation config values early", () => {
    expect(() =>
      runJeepneySimulation(createConfig({ route: { ...createConfig().route, stops: [] } }))
    ).toThrow("Simulation route must include at least one stop.");

    expect(() =>
      runJeepneySimulation(
        createConfig({
          route: {
            ...createConfig().route,
            stops: [
              { id: "stop-a", name: "Stop A" },
              { id: "stop-a", name: "Stop A Duplicate" }
            ]
          }
        })
      )
    ).toThrow("Route stop ids must be unique.");

    expect(() =>
      runJeepneySimulation(createConfig({ jeepneys: [] }))
    ).toThrow("Simulation must include at least one jeepney.");

    expect(() =>
      runJeepneySimulation(
        createConfig({
          jeepneys: [
            { id: "j1", label: "J1" },
            { id: "j1", label: "J1 Duplicate" }
          ]
        })
      )
    ).toThrow("Jeepney ids must be unique.");

    expect(() =>
      runJeepneySimulation(createConfig({ timeQuantum: 0 }))
    ).toThrow("Time quantum must be greater than zero.");

    expect(() =>
      runJeepneySimulation(createConfig({ timeQuantum: 1.5 }))
    ).toThrow("Time quantum must be a whole number.");

    expect(() =>
      runJeepneySimulation(createConfig({ ticks: -1 }))
    ).toThrow("Ticks must be zero or greater.");

    expect(() =>
      runJeepneySimulation(createConfig({ ticks: 1.5 }))
    ).toThrow("Ticks must be a whole number.");

    expect(() =>
      runJeepneySimulation(createConfig({ passengerArrivalRate: -1 }))
    ).toThrow("Passenger arrival rate must be zero or greater.");

    expect(() =>
      runJeepneySimulation(createConfig({ passengerArrivalRate: 1.5 }))
    ).toThrow("Passenger arrival rate must be a whole number.");

    expect(() =>
      runJeepneySimulation(createConfig({ passengerBoardingRate: 0 }))
    ).toThrow("Passenger boarding rate must be greater than zero.");

    expect(() =>
      runJeepneySimulation(createConfig({ passengerBoardingRate: 2.5 }))
    ).toThrow("Passenger boarding rate must be a whole number.");

    expect(() =>
      runJeepneySimulation(createConfig({ agingThreshold: 0 }))
    ).toThrow("Aging threshold must be greater than zero.");

    expect(() =>
      runJeepneySimulation(createConfig({ agingThreshold: 2.5 }))
    ).toThrow("Aging threshold must be a whole number.");

    expect(() =>
      runJeepneySimulation(
        createConfig({
          jeepneys: [{ id: "j1", label: "J1", initialStopIndex: 1.5 }]
        })
      )
    ).toThrow("Initial stop index must be a whole number.");

    expect(() =>
      runJeepneySimulation(
        createConfig({
          jeepneys: [{ id: "j1", label: "J1", initialWaitTicks: -1 }]
        })
      )
    ).toThrow("Initial wait ticks must be zero or greater.");

    expect(() =>
      runJeepneySimulation(
        createConfig({
          jeepneys: [{ id: "j1", label: "J1", initialWaitTicks: 1.5 }]
        })
      )
    ).toThrow("Initial wait ticks must be a whole number.");
  });
});
