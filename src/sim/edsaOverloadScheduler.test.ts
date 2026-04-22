import { describe, expect, it } from "vitest";
import { runEdsaOverloadSimulation } from "./edsaOverloadScheduler";
import type {
  CorridorRoute,
  CorridorVehicle,
  EdsaOverloadSimulationConfig
} from "./edsaOverloadTypes";

const routes: CorridorRoute[] = [
  { id: "edsa", name: "EDSA" },
  { id: "c5", name: "C5" },
  { id: "quirino", name: "Quirino" }
];

function createConfig(
  overrides: Partial<EdsaOverloadSimulationConfig> = {}
): EdsaOverloadSimulationConfig {
  return {
    routes,
    vehicles: [
      {
        id: "bus-1",
        label: "Bus 1",
        priorityClass: "bus",
        preferredRouteId: "edsa",
        arrivalTick: 0,
        serviceTicks: 3
      },
      {
        id: "car-1",
        label: "Car 1",
        priorityClass: "private",
        preferredRouteId: "edsa",
        arrivalTick: 0,
        serviceTicks: 2
      },
      {
        id: "ambulance-1",
        label: "Ambulance 1",
        priorityClass: "emergency",
        preferredRouteId: "edsa",
        arrivalTick: 1,
        serviceTicks: 1
      },
      {
        id: "jeep-1",
        label: "Jeep 1",
        priorityClass: "jeepney",
        preferredRouteId: "c5",
        arrivalTick: 1,
        serviceTicks: 1
      }
    ],
    ticks: 5,
    loadThreshold: 2,
    preemptionEnabled: true,
    ...overrides
  };
}

describe("runEdsaOverloadSimulation", () => {
  it("prioritizes emergency vehicles and preempts active lower-priority traffic", () => {
    const result = runEdsaOverloadSimulation(createConfig());

    expect(result.timeline.map((snapshot) => snapshot.activeVehicleId)).toEqual([
      "bus-1",
      "ambulance-1",
      "bus-1",
      "bus-1",
      "jeep-1"
    ]);
    expect(result.timeline[1]).toMatchObject({
      reason: "preempted",
      preemptedVehicleId: "bus-1",
      activePriorityClass: "emergency"
    });
  });

  it("keeps active work running when preemption disabled", () => {
    const result = runEdsaOverloadSimulation(
      createConfig({ preemptionEnabled: false })
    );

    expect(result.timeline.map((snapshot) => snapshot.activeVehicleId)).toEqual([
      "bus-1",
      "bus-1",
      "bus-1",
      "ambulance-1",
      "jeep-1"
    ]);
    expect(result.timeline[1].reason).toBe("continue-service");
    expect(result.timeline[1].preemptedVehicleId).toBeNull();
  });

  it("redirects new arrivals away from overloaded routes", () => {
    const congestedVehicles: CorridorVehicle[] = [
      {
        id: "bus-1",
        label: "Bus 1",
        priorityClass: "bus",
        preferredRouteId: "edsa",
        arrivalTick: 0,
        serviceTicks: 3
      },
      {
        id: "car-1",
        label: "Car 1",
        priorityClass: "private",
        preferredRouteId: "edsa",
        arrivalTick: 0,
        serviceTicks: 2
      },
      {
        id: "bus-2",
        label: "Bus 2",
        priorityClass: "bus",
        preferredRouteId: "edsa",
        arrivalTick: 1,
        serviceTicks: 1
      },
      {
        id: "car-2",
        label: "Car 2",
        priorityClass: "private",
        preferredRouteId: "edsa",
        arrivalTick: 1,
        serviceTicks: 1
      }
    ];

    const result = runEdsaOverloadSimulation(
      createConfig({
        vehicles: congestedVehicles,
        ticks: 3,
        preemptionEnabled: false
      })
    );

    expect(result.timeline[1].redirectedVehicleIds).toEqual(["bus-2", "car-2"]);
    expect(result.vehicles["bus-2"].assignedRouteId).toBe("c5");
    expect(result.vehicles["car-2"].assignedRouteId).toBe("quirino");
    expect(result.timeline[1].totalRedirectedVehicles).toBe(2);
  });

  it("tracks queue lengths and average wait by route on every tick", () => {
    const result = runEdsaOverloadSimulation(
      createConfig({
        ticks: 3,
        preemptionEnabled: false
      })
    );

    expect(result.timeline[0]).toMatchObject({
      queueLengthByRouteId: {
        edsa: 1,
        c5: 0,
        quirino: 0
      },
      averageWaitByRouteId: {
        edsa: 1,
        c5: 0,
        quirino: 0
      }
    });

    expect(result.timeline[1]).toMatchObject({
      queueLengthByRouteId: {
        edsa: 2,
        c5: 1,
        quirino: 0
      }
    });
    expect(result.timeline[1].averageWaitByRouteId.edsa).toBeGreaterThan(0);
    expect(result.timeline[1].averageWaitByRouteId.c5).toBeGreaterThan(0);
  });

  it("rejects invalid corridor simulation config values early", () => {
    expect(() =>
      runEdsaOverloadSimulation(createConfig({ routes: [] }))
    ).toThrow("Simulation must include at least one route.");

    expect(() =>
      runEdsaOverloadSimulation(
        createConfig({
          routes: [
            { id: "edsa", name: "EDSA" },
            { id: "edsa", name: "EDSA Duplicate" }
          ]
        })
      )
    ).toThrow("Route ids must be unique.");

    expect(() =>
      runEdsaOverloadSimulation(createConfig({ vehicles: [] }))
    ).toThrow("Simulation must include at least one vehicle.");

    expect(() =>
      runEdsaOverloadSimulation(
        createConfig({
          vehicles: [
            {
              id: "bus-1",
              label: "Bus 1",
              priorityClass: "bus",
              preferredRouteId: "edsa",
              arrivalTick: 0,
              serviceTicks: 1
            },
            {
              id: "bus-1",
              label: "Bus 1 Duplicate",
              priorityClass: "bus",
              preferredRouteId: "c5",
              arrivalTick: 1,
              serviceTicks: 1
            }
          ]
        })
      )
    ).toThrow("Vehicle ids must be unique.");

    expect(() =>
      runEdsaOverloadSimulation(createConfig({ ticks: -1 }))
    ).toThrow("Ticks must be zero or greater.");

    expect(() =>
      runEdsaOverloadSimulation(createConfig({ ticks: 1.5 }))
    ).toThrow("Ticks must be a whole number.");

    expect(() =>
      runEdsaOverloadSimulation(createConfig({ loadThreshold: 0 }))
    ).toThrow("Load threshold must be greater than zero.");

    expect(() =>
      runEdsaOverloadSimulation(createConfig({ loadThreshold: 1.5 }))
    ).toThrow("Load threshold must be a whole number.");

    expect(() =>
      runEdsaOverloadSimulation(
        createConfig({
          vehicles: [
            {
              id: "bad-arrival",
              label: "Bad Arrival",
              priorityClass: "private",
              preferredRouteId: "edsa",
              arrivalTick: -1,
              serviceTicks: 1
            }
          ]
        })
      )
    ).toThrow("Vehicle arrival tick must be zero or greater.");

    expect(() =>
      runEdsaOverloadSimulation(
        createConfig({
          vehicles: [
            {
              id: "bad-service",
              label: "Bad Service",
              priorityClass: "private",
              preferredRouteId: "edsa",
              arrivalTick: 0,
              serviceTicks: 0
            }
          ]
        })
      )
    ).toThrow("Vehicle service ticks must be greater than zero.");

    expect(() =>
      runEdsaOverloadSimulation(
        createConfig({
          vehicles: [
            {
              id: "bad-route",
              label: "Bad Route",
              priorityClass: "private",
              preferredRouteId: "edsa" as never,
              arrivalTick: 0,
              serviceTicks: 1
            }
          ],
          routes: [{ id: "c5", name: "C5" }]
        })
      )
    ).toThrow("Unknown preferred route id: edsa.");
  });
});
