import type {
  Jeepney,
  JeepneySimulationConfig,
  JeepneySimulationResult,
  JeepneyState,
  MetricsSnapshot,
  Route,
  SchedulingEvent,
  SimulationReason
} from "./types";

type MutableSimulationState = {
  activeJeepneyId: string | null;
  contextSwitches: number;
  events: SchedulingEvent[];
  jeepneyStates: Record<string, JeepneyState>;
  lastDispatchExpiredQuantum: boolean;
  lastExecutedJeepneyId: string | null;
  metrics: MetricsSnapshot[];
  quantumUsed: number;
  readyQueue: string[];
  throughput: number;
  totalWaitTime: number;
};

function assertValidConfig(config: JeepneySimulationConfig) {
  if (config.route.stops.length === 0) {
    throw new Error("Simulation route must include at least one stop.");
  }

  if (config.jeepneys.length === 0) {
    throw new Error("Simulation must include at least one jeepney.");
  }

  if (config.timeQuantum <= 0) {
    throw new Error("Time quantum must be greater than zero.");
  }

  if (config.ticks < 0) {
    throw new Error("Ticks must be zero or greater.");
  }
}

function createJeepneyState(route: Route, jeepney: Jeepney): JeepneyState {
  const stopCount = route.stops.length;
  const initialStopIndex = jeepney.initialStopIndex ?? 0;

  return {
    id: jeepney.id,
    label: jeepney.label,
    nextStopIndex: ((initialStopIndex % stopCount) + stopCount) % stopCount,
    completedStops: 0,
    totalWaitTicks: jeepney.initialWaitTicks ?? 0,
    currentWaitTicks: jeepney.initialWaitTicks ?? 0,
    agingBoosts: 0
  };
}

function selectNextJeepney(
  config: JeepneySimulationConfig,
  state: MutableSimulationState
): { activeJeepneyId: string; reason: SimulationReason } {
  if (state.activeJeepneyId && state.quantumUsed < config.timeQuantum) {
    return {
      activeJeepneyId: state.activeJeepneyId,
      reason: "continue-quantum"
    };
  }

  const fallbackId = state.readyQueue[0];

  if (!fallbackId) {
    throw new Error("Ready queue cannot be empty when selecting next jeepney.");
  }

  if (!config.agingEnabled || config.agingThreshold === undefined) {
    state.readyQueue.shift();

    return {
      activeJeepneyId: fallbackId,
      reason: state.lastDispatchExpiredQuantum ? "quantum-expired" : "dispatch"
    };
  }

  let agingCandidateIndex = -1;
  let highestWait = config.agingThreshold - 1;

  state.readyQueue.forEach((jeepneyId, index) => {
    const jeepneyState = state.jeepneyStates[jeepneyId];

    if (jeepneyState.currentWaitTicks > highestWait) {
      highestWait = jeepneyState.currentWaitTicks;
      agingCandidateIndex = index;
    }
  });

  if (agingCandidateIndex === -1) {
    state.readyQueue.shift();

    return {
      activeJeepneyId: fallbackId,
      reason: state.lastDispatchExpiredQuantum ? "quantum-expired" : "dispatch"
    };
  }

  const [boostedJeepneyId] = state.readyQueue.splice(agingCandidateIndex, 1);
  state.jeepneyStates[boostedJeepneyId].agingBoosts += 1;

  return {
    activeJeepneyId: boostedJeepneyId,
    reason: "aging-boost"
  };
}

function updateWaitingJeepneys(
  activeJeepneyId: string,
  state: MutableSimulationState
) {
  state.readyQueue.forEach((jeepneyId) => {
    if (jeepneyId === activeJeepneyId) {
      return;
    }

    const jeepneyState = state.jeepneyStates[jeepneyId];
    jeepneyState.currentWaitTicks += 1;
    jeepneyState.totalWaitTicks += 1;
    state.totalWaitTime += 1;
  });
}

function countStarvationRisk(
  config: JeepneySimulationConfig,
  state: MutableSimulationState
) {
  const threshold = config.agingThreshold ?? config.timeQuantum * 2;

  return Object.values(state.jeepneyStates).filter(
    (jeepney) => jeepney.currentWaitTicks >= threshold
  ).length;
}

export function runJeepneySimulation(
  config: JeepneySimulationConfig
): JeepneySimulationResult {
  assertValidConfig(config);

  const jeepneyStates = Object.fromEntries(
    config.jeepneys.map((jeepney) => [
      jeepney.id,
      createJeepneyState(config.route, jeepney)
    ])
  );

  const state: MutableSimulationState = {
    activeJeepneyId: null,
    contextSwitches: 0,
    events: [],
    jeepneyStates,
    lastDispatchExpiredQuantum: false,
    lastExecutedJeepneyId: null,
    metrics: [],
    quantumUsed: 0,
    readyQueue: config.jeepneys.map((jeepney) => jeepney.id),
    throughput: 0,
    totalWaitTime: 0
  };

  for (let tick = 0; tick < config.ticks; tick += 1) {
    const selection = selectNextJeepney(config, state);
    state.activeJeepneyId = selection.activeJeepneyId;

    if (
      state.lastExecutedJeepneyId !== null &&
      state.lastExecutedJeepneyId !== state.activeJeepneyId
    ) {
      state.contextSwitches += 1;
    }

    const activeJeepney = state.jeepneyStates[state.activeJeepneyId];
    const stopIndex = activeJeepney.nextStopIndex;
    const stop = config.route.stops[stopIndex];

    activeJeepney.completedStops += 1;
    activeJeepney.nextStopIndex =
      (activeJeepney.nextStopIndex + 1) % config.route.stops.length;
    activeJeepney.currentWaitTicks = 0;

    state.quantumUsed += 1;
    state.throughput += 1;
    updateWaitingJeepneys(state.activeJeepneyId, state);
    state.lastExecutedJeepneyId = state.activeJeepneyId;

    state.events.push({
      tick,
      activeJeepneyId: state.activeJeepneyId,
      stopId: stop.id,
      stopIndex,
      queue: [...state.readyQueue],
      reason: selection.reason,
      quantumUsed: state.quantumUsed
    });

    state.metrics.push({
      tick,
      activeJeepneyId: state.activeJeepneyId,
      throughput: state.throughput,
      totalWaitTime: state.totalWaitTime,
      averageWaitTime: state.totalWaitTime / config.jeepneys.length,
      contextSwitches: state.contextSwitches,
      starvationRisk: countStarvationRisk(config, state),
      queue: [...state.readyQueue]
    });

    if (state.quantumUsed >= config.timeQuantum) {
      state.readyQueue.push(state.activeJeepneyId);
      state.activeJeepneyId = null;
      state.quantumUsed = 0;
      state.lastDispatchExpiredQuantum = true;
    } else {
      state.lastDispatchExpiredQuantum = false;
    }
  }

  return {
    events: state.events,
    metrics: state.metrics,
    jeepneys: state.jeepneyStates
  };
}
