import type {
  JeepneySimulationConfig,
  JeepneySimulationResult,
  SimulationReason
} from "./types";

export type JeepneyPlaybackState = {
  id: string;
  label: string;
  stopIndex: number;
  completedStops: number;
  isActive: boolean;
  isWaiting: boolean;
  queueIndex: number | null;
};

export type JeepneyPlaybackFrame = {
  tick: number;
  activeJeepneyId: string | null;
  queue: string[];
  reason: SimulationReason | null;
  quantumUsed: number;
  stopId: string | null;
  stopIndex: number | null;
  jeepneys: JeepneyPlaybackState[];
};

function normalizeStopIndex(stopIndex: number, stopCount: number) {
  return ((stopIndex % stopCount) + stopCount) % stopCount;
}

export function buildJeepneyPlaybackFrames(
  config: JeepneySimulationConfig,
  result: JeepneySimulationResult
): JeepneyPlaybackFrame[] {
  const stopCount = config.route.stops.length;
  const states = Object.fromEntries(
    config.jeepneys.map((jeepney) => [
      jeepney.id,
      {
        id: jeepney.id,
        label: jeepney.label,
        stopIndex: normalizeStopIndex(jeepney.initialStopIndex ?? 0, stopCount),
        completedStops: 0,
        isActive: false,
        isWaiting: true,
        queueIndex: null
      }
    ])
  );

  const createFrame = (
    tick: number,
    activeJeepneyId: string | null,
    queue: string[],
    reason: SimulationReason | null,
    quantumUsed: number,
    stopId: string | null,
    stopIndex: number | null
  ): JeepneyPlaybackFrame => {
    const queueOrder = new Map(queue.map((jeepneyId, index) => [jeepneyId, index]));

    return {
      tick,
      activeJeepneyId,
      queue,
      reason,
      quantumUsed,
      stopId,
      stopIndex,
      jeepneys: Object.values(states).map((jeepney) => ({
        ...jeepney,
        isActive: jeepney.id === activeJeepneyId,
        isWaiting: queueOrder.has(jeepney.id),
        queueIndex: queueOrder.get(jeepney.id) ?? null
      }))
    };
  };

  const frames: JeepneyPlaybackFrame[] = [
    createFrame(
      -1,
      null,
      config.jeepneys.map((jeepney) => jeepney.id),
      null,
      0,
      null,
      null
    )
  ];

  result.events.forEach((event) => {
    const jeepneyState = states[event.activeJeepneyId];
    jeepneyState.stopIndex = event.stopIndex;
    jeepneyState.completedStops += 1;

    frames.push(
      createFrame(
        event.tick,
        event.activeJeepneyId,
        event.queue,
        event.reason,
        event.quantumUsed,
        event.stopId,
        event.stopIndex
      )
    );
  });

  return frames;
}
