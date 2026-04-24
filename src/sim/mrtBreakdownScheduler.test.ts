import { describe, expect, it } from "vitest";
import { runMrtBreakdownSimulation } from "./mrtBreakdownScheduler";
import type { MrtBreakdownSimulationConfig } from "./mrtBreakdownTypes";

function createConfig(
  overrides: Partial<MrtBreakdownSimulationConfig> = {}
): MrtBreakdownSimulationConfig {
  return {
    stations: [
      { id: "north-ave", name: "North Ave" },
      { id: "cubao", name: "Cubao" },
      { id: "shaw", name: "Shaw" }
    ],
    backupRoutes: [
      { id: "carousel", name: "EDSA Carousel", capacityPerTick: 3 },
      { id: "shuttle", name: "P2P Shuttle", capacityPerTick: 2 }
    ],
    ticks: 8,
    passengerArrivalRate: 2,
    primaryCapacityPerTick: 8,
    degradedCapacityPerTick: 4,
    dropThreshold: 4,
    fault: {
      stationId: "cubao",
      startTick: 2,
      recoveryTick: 6
    },
    ...overrides
  };
}

describe("runMrtBreakdownSimulation", () => {
  it("runs normal service without migration or dropped passengers", () => {
    const result = runMrtBreakdownSimulation(createConfig({ fault: null }));

    expect(result.timeline).toHaveLength(8);
    expect(result.timeline.every((snapshot) => snapshot.status === "normal")).toBe(
      true
    );
    expect(
      result.timeline.every(
        (snapshot) =>
          snapshot.totalMigratedPassengers === 0 &&
          snapshot.totalDroppedPassengers === 0 &&
          snapshot.serviceLevelPercent === 100
      )
    ).toBe(true);
  });

  it("marks the failed station and degrades primary service during the fault", () => {
    const result = runMrtBreakdownSimulation(createConfig());
    const faultSnapshot = result.timeline[2];

    expect(faultSnapshot).toMatchObject({
      event: "fault-injected",
      failedStationId: "cubao",
      status: "degraded",
      serviceLevelPercent: 50
    });
    expect(faultSnapshot.primaryServedPassengers).toBeLessThan(8);
  });

  it("migrates failed-station passengers to backup routes", () => {
    const result = runMrtBreakdownSimulation(createConfig());
    const migrationSnapshot = result.timeline[2];

    expect(migrationSnapshot.migratedPassengers).toBeGreaterThan(0);
    expect(migrationSnapshot.backupRouteLoads).toEqual({
      carousel: 2,
      shuttle: 0
    });
    expect(migrationSnapshot.totalMigratedPassengers).toBe(2);
    expect(migrationSnapshot.migrationTimeTicks).toBe(1);
  });

  it("shares primary capacity fairly across online station queues", () => {
    const result = runMrtBreakdownSimulation(
      createConfig({
        backupRoutes: [],
        fault: null,
        degradedCapacityPerTick: 2,
        passengerArrivalRate: 4,
        primaryCapacityPerTick: 3,
        ticks: 1
      })
    );

    expect(result.timeline[0].primaryServedPassengers).toBe(3);
    expect(result.timeline[0].stationQueues).toEqual({
      "north-ave": 4,
      cubao: 3,
      shaw: 3
    });
  });

  it("protects failed-station passengers from primary service until failover or recovery", () => {
    const result = runMrtBreakdownSimulation(
      createConfig({
        backupRoutes: [],
        degradedCapacityPerTick: 2,
        fault: {
          stationId: "cubao",
          startTick: 0,
          recoveryTick: 2
        },
        passengerArrivalRate: 2,
        ticks: 3
      })
    );

    expect(result.timeline[0].stationQueues.cubao).toBe(2);
    expect(result.timeline[1].stationQueues.cubao).toBe(4);
    expect(result.timeline[2]).toMatchObject({
      event: "service-restored",
      failedStationId: null,
      primaryServedPassengers: 8
    });
    expect(result.timeline[2].stationQueues.cubao).toBeLessThan(6);
  });

  it("drops passengers when backup capacity cannot clear overload", () => {
    const result = runMrtBreakdownSimulation(
      createConfig({
        backupRoutes: [{ id: "carousel", name: "EDSA Carousel", capacityPerTick: 1 }],
        passengerArrivalRate: 5,
        dropThreshold: 2
      })
    );
    const dropEvent = result.timeline.find(
      (snapshot) => snapshot.event === "passengers-dropped"
    );

    expect(dropEvent).toBeDefined();
    expect(dropEvent?.droppedPassengers).toBeGreaterThan(0);
    expect(dropEvent?.totalDroppedPassengers).toBeGreaterThan(0);
  });

  it("returns to recovered service after the recovery tick", () => {
    const result = runMrtBreakdownSimulation(createConfig());
    const recoveredSnapshot = result.timeline[6];

    expect(recoveredSnapshot).toMatchObject({
      event: "service-restored",
      failedStationId: null,
      status: "recovered",
      serviceLevelPercent: 100,
      droppedPassengers: 0
    });
  });

  it("rejects invalid MRT simulation config values early", () => {
    expect(() =>
      runMrtBreakdownSimulation(createConfig({ stations: [] }))
    ).toThrow("MRT simulation must include at least one station.");

    expect(() =>
      runMrtBreakdownSimulation(
        createConfig({
          backupRoutes: [
            { id: "carousel", name: "EDSA Carousel", capacityPerTick: 1 },
            { id: "carousel", name: "Duplicate", capacityPerTick: 1 }
          ]
        })
      )
    ).toThrow("Backup route ids must be unique.");

    expect(() =>
      runMrtBreakdownSimulation(
        createConfig({ fault: { stationId: "taft", startTick: 2, recoveryTick: 6 } })
      )
    ).toThrow("Unknown fault station id: taft.");

    expect(() =>
      runMrtBreakdownSimulation(
        createConfig({ fault: { stationId: "cubao", startTick: 4, recoveryTick: 4 } })
      )
    ).toThrow("Recovery tick must be after fault start tick.");

    expect(() =>
      runMrtBreakdownSimulation(
        createConfig({
          primaryCapacityPerTick: 4,
          degradedCapacityPerTick: 5
        })
      )
    ).toThrow("Degraded capacity cannot exceed primary capacity.");
  });
});
