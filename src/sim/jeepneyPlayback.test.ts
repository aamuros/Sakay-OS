import { describe, expect, it } from "vitest";
import { runJeepneySimulation } from "./jeepneyScheduler";
import { buildJeepneyPlaybackFrames } from "./jeepneyPlayback";
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
      { id: "j1", label: "J1", initialStopIndex: 0 },
      { id: "j2", label: "J2", initialStopIndex: 1 }
    ],
    ticks: 3,
    timeQuantum: 2,
    agingEnabled: false,
    ...overrides
  };
}

describe("buildJeepneyPlaybackFrames", () => {
  it("creates initial frame before playback starts", () => {
    const config = createConfig({
      jeepneys: [
        { id: "j1", label: "J1", initialStopIndex: -1 },
        { id: "j2", label: "J2", initialStopIndex: 4 }
      ]
    });
    const result = runJeepneySimulation(config);
    const frames = buildJeepneyPlaybackFrames(config, result);

    expect(frames[0]).toMatchObject({
      tick: -1,
      activeJeepneyId: null,
      queue: ["j1", "j2"],
      reason: null,
      quantumUsed: 0
    });

    expect(frames[0].jeepneys).toEqual([
      {
        id: "j1",
        label: "J1",
        stopIndex: 2,
        completedStops: 0,
        isActive: false,
        isWaiting: true,
        queueIndex: 0
      },
      {
        id: "j2",
        label: "J2",
        stopIndex: 1,
        completedStops: 0,
        isActive: false,
        isWaiting: true,
        queueIndex: 1
      }
    ]);
  });

  it("moves only scheduled jeepney and preserves queue snapshot order", () => {
    const config = createConfig();
    const result = runJeepneySimulation(config);
    const frames = buildJeepneyPlaybackFrames(config, result);

    expect(frames[1]).toMatchObject({
      tick: 0,
      activeJeepneyId: "j1",
      queue: ["j2"],
      reason: "dispatch",
      stopId: "stop-a",
      stopIndex: 0
    });

    expect(frames[2].jeepneys).toEqual([
      {
        id: "j1",
        label: "J1",
        stopIndex: 1,
        completedStops: 2,
        isActive: true,
        isWaiting: false,
        queueIndex: null
      },
      {
        id: "j2",
        label: "J2",
        stopIndex: 1,
        completedStops: 0,
        isActive: false,
        isWaiting: true,
        queueIndex: 0
      }
    ]);

    expect(frames[3]).toMatchObject({
      tick: 2,
      activeJeepneyId: "j2",
      queue: ["j1"]
    });
  });
});
