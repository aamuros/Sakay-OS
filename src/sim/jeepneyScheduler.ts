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
  passengerQueues: Record<string, number>;
  quantumUsed: number;
  readyQueue: string[];
  totalPassengersServed: number;
  throughput: number;
  totalWaitTime: number;
};

function assertWholeNumber(value: number, label: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
}

function assertUniqueIds(ids: string[], label: string) {
  const seenIds = new Set<string>();

  ids.forEach((id) => {
    if (seenIds.has(id)) {
      throw new Error(`${label} ids must be unique.`);
    }

    seenIds.add(id);
  });
}

function assertValidConfig(config: JeepneySimulationConfig) {
  if (config.route.stops.length === 0) {
    throw new Error("Simulation route must include at least one stop.");
  }

  assertUniqueIds(
    config.route.stops.map((stop) => stop.id),
    "Route stop"
  );

  if (config.jeepneys.length === 0) {
    throw new Error("Simulation must include at least one jeepney.");
  }

  assertUniqueIds(
    config.jeepneys.map((jeepney) => jeepney.id),
    "Jeepney"
  );

  assertWholeNumber(config.timeQuantum, "Time quantum");

  if (config.timeQuantum <= 0) {
    throw new Error("Time quantum must be greater than zero.");
  }

  assertWholeNumber(config.ticks, "Ticks");

  if (config.ticks < 0) {
    throw new Error("Ticks must be zero or greater.");
  }

  const passengerArrivalRate = config.passengerArrivalRate ?? 0;
  assertWholeNumber(passengerArrivalRate, "Passenger arrival rate");

  if (passengerArrivalRate < 0) {
    throw new Error("Passenger arrival rate must be zero or greater.");
  }

  const passengerBoardingRate = config.passengerBoardingRate ?? 4;
  assertWholeNumber(passengerBoardingRate, "Passenger boarding rate");

  if (passengerBoardingRate <= 0) {
    throw new Error("Passenger boarding rate must be greater than zero.");
  }

  if (config.agingThreshold !== undefined) {
    assertWholeNumber(config.agingThreshold, "Aging threshold");

    if (config.agingThreshold <= 0) {
      throw new Error("Aging threshold must be greater than zero.");
    }
  }

  config.jeepneys.forEach((jeepney) => {
    if (jeepney.initialStopIndex !== undefined) {
      assertWholeNumber(jeepney.initialStopIndex, "Initial stop index");
    }

    if (jeepney.initialWaitTicks !== undefined) {
      assertWholeNumber(jeepney.initialWaitTicks, "Initial wait ticks");

      if (jeepney.initialWaitTicks < 0) {
        throw new Error("Initial wait ticks must be zero or greater.");
      }
    }
  });
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

  const agingThreshold = getDispatchAgingThreshold(config);

  if (agingThreshold === null) {
    state.readyQueue.shift();

    return {
      activeJeepneyId: fallbackId,
      reason: state.lastDispatchExpiredQuantum ? "quantum-expired" : "dispatch"
    };
  }

  let agingCandidateIndex = -1;
  let highestWait = agingThreshold - 1;

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
  config: JeepneySimulationConfig,
  activeJeepneyId: string,
  state: MutableSimulationState
) {
  state.readyQueue.forEach((jeepneyId) => {
    if (jeepneyId === activeJeepneyId) {
      return;
    }

    const jeepneyState = state.jeepneyStates[jeepneyId];
    const stopId = config.route.stops[jeepneyState.nextStopIndex].id;
    const passengerPressure = state.passengerQueues[stopId] ?? 0;
    const boardingRate = config.passengerBoardingRate ?? 4;
    const waitIncrement =
      1 + Math.min(Math.floor(passengerPressure / boardingRate), 2);

    jeepneyState.currentWaitTicks += waitIncrement;
    jeepneyState.totalWaitTicks += waitIncrement;
    state.totalWaitTime += waitIncrement;
  });
}

function getDispatchAgingThreshold(config: JeepneySimulationConfig) {
  if (!config.agingEnabled) {
    return null;
  }

  return config.agingThreshold ?? config.timeQuantum * 2;
}

function getStarvationThreshold(config: JeepneySimulationConfig) {
  return config.agingThreshold ?? config.timeQuantum * 2;
}

function listStarvationRiskIds(
  config: JeepneySimulationConfig,
  state: MutableSimulationState
) {
  const threshold = getStarvationThreshold(config);

  return Object.values(state.jeepneyStates)
    .filter((jeepney) => jeepney.currentWaitTicks >= threshold)
    .map((jeepney) => jeepney.id)
    .sort();
}

function buildPassengerQueues(route: Route) {
  return Object.fromEntries(route.stops.map((stop) => [stop.id, 0]));
}

function addPassengerArrivals(
  config: JeepneySimulationConfig,
  state: MutableSimulationState,
  tick: number
) {
  const baseArrivalRate = config.passengerArrivalRate ?? 0;

  config.route.stops.forEach((stop, index) => {
    const surge = (tick + index) % 3 === 0 ? 1 : 0;
    state.passengerQueues[stop.id] += baseArrivalRate + surge;
  });
}

function countPassengerBacklog(state: MutableSimulationState) {
  return Object.values(state.passengerQueues).reduce(
    (total, count) => total + count,
    0
  );
}

function findBusiestStopId(
  route: Route,
  passengerQueues: Record<string, number>
) {
  let busiestStopId: string | null = null;
  let highestBacklog = -1;

  route.stops.forEach((stop) => {
    const backlog = passengerQueues[stop.id] ?? 0;

    if (backlog > highestBacklog) {
      highestBacklog = backlog;
      busiestStopId = stop.id;
    }
  });

  return highestBacklog > 0 ? busiestStopId : null;
}

function snapshotWaitByJeepney(state: MutableSimulationState) {
  return Object.fromEntries(
    Object.values(state.jeepneyStates)
      .sort((first, second) => first.id.localeCompare(second.id))
      .map((jeepney) => [jeepney.id, jeepney.currentWaitTicks])
  );
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
    passengerQueues: buildPassengerQueues(config.route),
    quantumUsed: 0,
    readyQueue: config.jeepneys.map((jeepney) => jeepney.id),
    totalPassengersServed: 0,
    throughput: 0,
    totalWaitTime: 0
  };

  for (let tick = 0; tick < config.ticks; tick += 1) {
    addPassengerArrivals(config, state, tick);

    const selection = selectNextJeepney(config, state);
    state.activeJeepneyId = selection.activeJeepneyId;
    const activeJeepney = state.jeepneyStates[state.activeJeepneyId];
    const activeWaitTicks = activeJeepney.currentWaitTicks;
    let didContextSwitch = false;

    if (
      state.lastExecutedJeepneyId !== null &&
      state.lastExecutedJeepneyId !== state.activeJeepneyId
    ) {
      state.contextSwitches += 1;
      didContextSwitch = true;
    }

    const stopIndex = activeJeepney.nextStopIndex;
    const stop = config.route.stops[stopIndex];
    const boardingRate = config.passengerBoardingRate ?? 4;
    const servedPassengers = Math.min(
      state.passengerQueues[stop.id] ?? 0,
      boardingRate
    );

    state.passengerQueues[stop.id] -= servedPassengers;
    state.totalPassengersServed += servedPassengers;

    activeJeepney.completedStops += 1;
    activeJeepney.nextStopIndex =
      (activeJeepney.nextStopIndex + 1) % config.route.stops.length;
    activeJeepney.currentWaitTicks = 0;

    state.quantumUsed += 1;
    state.throughput += 1;
    updateWaitingJeepneys(config, state.activeJeepneyId, state);
    state.lastExecutedJeepneyId = state.activeJeepneyId;

    const atRiskJeepneyIds = listStarvationRiskIds(config, state);
    const passengerBacklog = countPassengerBacklog(state);
    const busiestStopId = findBusiestStopId(config.route, state.passengerQueues);

    state.events.push({
      tick,
      activeJeepneyId: state.activeJeepneyId,
      stopId: stop.id,
      stopIndex,
      queue: [...state.readyQueue],
      reason: selection.reason,
      quantumUsed: state.quantumUsed,
      didContextSwitch,
      activeWaitTicks,
      servedPassengers,
      passengerBacklog,
      busiestStopId
    });

    state.metrics.push({
      tick,
      activeJeepneyId: state.activeJeepneyId,
      throughput: state.throughput,
      totalWaitTime: state.totalWaitTime,
      averageWaitTime: state.totalWaitTime / config.jeepneys.length,
      contextSwitches: state.contextSwitches,
      starvationRisk: atRiskJeepneyIds.length,
      queue: [...state.readyQueue],
      atRiskJeepneyIds,
      waitByJeepneyId: snapshotWaitByJeepney(state),
      passengerBacklog,
      stopPassengerQueues: { ...state.passengerQueues },
      busiestStopId,
      servedPassengers,
      totalPassengersServed: state.totalPassengersServed
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
