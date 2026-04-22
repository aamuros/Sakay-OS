import type {
  CorridorRoute,
  CorridorRouteId,
  CorridorSimulationReason,
  CorridorTickSnapshot,
  CorridorVehicle,
  CorridorVehicleState,
  EdsaOverloadSimulationConfig,
  EdsaOverloadSimulationResult,
  VehiclePriorityClass
} from "./edsaOverloadTypes";

type MutableSimulationState = {
  activeVehicleId: string | null;
  completedVehicles: number;
  redirectedCountByRouteId: Record<CorridorRouteId, number>;
  routeQueues: Record<CorridorRouteId, string[]>;
  routeSequence: CorridorRouteId[];
  timeline: CorridorTickSnapshot[];
  totalRedirectedVehicles: number;
  vehicleStates: Record<string, CorridorVehicleState>;
};

const priorityRankByClass: Record<VehiclePriorityClass, number> = {
  emergency: 3,
  bus: 2,
  jeepney: 1,
  private: 0
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

function assertValidConfig(config: EdsaOverloadSimulationConfig) {
  if (config.routes.length === 0) {
    throw new Error("Simulation must include at least one route.");
  }

  assertUniqueIds(
    config.routes.map((route) => route.id),
    "Route"
  );

  if (config.vehicles.length === 0) {
    throw new Error("Simulation must include at least one vehicle.");
  }

  assertUniqueIds(
    config.vehicles.map((vehicle) => vehicle.id),
    "Vehicle"
  );

  assertWholeNumber(config.ticks, "Ticks");

  if (config.ticks < 0) {
    throw new Error("Ticks must be zero or greater.");
  }

  assertWholeNumber(config.loadThreshold, "Load threshold");

  if (config.loadThreshold <= 0) {
    throw new Error("Load threshold must be greater than zero.");
  }

  const routeIds = new Set(config.routes.map((route) => route.id));

  config.vehicles.forEach((vehicle) => {
    assertWholeNumber(vehicle.arrivalTick, "Vehicle arrival tick");

    if (vehicle.arrivalTick < 0) {
      throw new Error("Vehicle arrival tick must be zero or greater.");
    }

    assertWholeNumber(vehicle.serviceTicks, "Vehicle service ticks");

    if (vehicle.serviceTicks <= 0) {
      throw new Error("Vehicle service ticks must be greater than zero.");
    }

    if (!routeIds.has(vehicle.preferredRouteId)) {
      throw new Error(`Unknown preferred route id: ${vehicle.preferredRouteId}.`);
    }
  });
}

function buildQueueRecord<T>(
  routes: CorridorRoute[],
  buildValue: () => T
): Record<CorridorRouteId, T> {
  return Object.fromEntries(
    routes.map((route) => [route.id, buildValue()])
  ) as Record<CorridorRouteId, T>;
}

function createVehicleState(
  vehicle: CorridorVehicle
): CorridorVehicleState {
  return {
    id: vehicle.id,
    label: vehicle.label,
    priorityClass: vehicle.priorityClass,
    preferredRouteId: vehicle.preferredRouteId,
    assignedRouteId: vehicle.preferredRouteId,
    arrivalTick: vehicle.arrivalTick,
    serviceTicks: vehicle.serviceTicks,
    remainingServiceTicks: vehicle.serviceTicks,
    totalWaitTicks: 0,
    currentWaitTicks: 0,
    wasRedirected: false,
    completedAtTick: null
  };
}

function getPriorityRank(priorityClass: VehiclePriorityClass) {
  return priorityRankByClass[priorityClass];
}

function getVehicleLoadOnRoute(
  routeId: CorridorRouteId,
  state: MutableSimulationState
) {
  const activeVehicleRouteId = state.activeVehicleId
    ? state.vehicleStates[state.activeVehicleId].assignedRouteId
    : null;

  return (
    state.routeQueues[routeId].length + (activeVehicleRouteId === routeId ? 1 : 0)
  );
}

function compareRouteIds(
  routeSequence: CorridorRouteId[],
  firstRouteId: CorridorRouteId,
  secondRouteId: CorridorRouteId
) {
  return (
    routeSequence.indexOf(firstRouteId) - routeSequence.indexOf(secondRouteId)
  );
}

function compareQueuedVehicles(
  state: MutableSimulationState,
  firstVehicleId: string,
  secondVehicleId: string
) {
  const firstVehicle = state.vehicleStates[firstVehicleId];
  const secondVehicle = state.vehicleStates[secondVehicleId];
  const priorityGap =
    getPriorityRank(secondVehicle.priorityClass) -
    getPriorityRank(firstVehicle.priorityClass);

  if (priorityGap !== 0) {
    return priorityGap;
  }

  const waitGap = secondVehicle.currentWaitTicks - firstVehicle.currentWaitTicks;

  if (waitGap !== 0) {
    return waitGap;
  }

  const routeLoadGap =
    getVehicleLoadOnRoute(secondVehicle.assignedRouteId, state) -
    getVehicleLoadOnRoute(firstVehicle.assignedRouteId, state);

  if (routeLoadGap !== 0) {
    return routeLoadGap;
  }

  const arrivalGap = firstVehicle.arrivalTick - secondVehicle.arrivalTick;

  if (arrivalGap !== 0) {
    return arrivalGap;
  }

  const routeGap = compareRouteIds(
    state.routeSequence,
    firstVehicle.assignedRouteId,
    secondVehicle.assignedRouteId
  );

  if (routeGap !== 0) {
    return routeGap;
  }

  return firstVehicle.id.localeCompare(secondVehicle.id);
}

function listOrderedQueue(
  state: MutableSimulationState,
  routeId: CorridorRouteId
) {
  return [...state.routeQueues[routeId]].sort((firstVehicleId, secondVehicleId) =>
    compareQueuedVehicles(state, firstVehicleId, secondVehicleId)
  );
}

function pickLeastLoadedRoute(
  config: EdsaOverloadSimulationConfig,
  state: MutableSimulationState
) {
  return [...config.routes]
    .sort((firstRoute, secondRoute) => {
      const loadGap =
        getVehicleLoadOnRoute(firstRoute.id, state) -
        getVehicleLoadOnRoute(secondRoute.id, state);

      if (loadGap !== 0) {
        return loadGap;
      }

      return compareRouteIds(state.routeSequence, firstRoute.id, secondRoute.id);
    })[0].id;
}

function assignArrivalRoute(
  config: EdsaOverloadSimulationConfig,
  state: MutableSimulationState,
  vehicleId: string
) {
  const vehicleState = state.vehicleStates[vehicleId];
  const preferredRouteLoad = getVehicleLoadOnRoute(
    vehicleState.preferredRouteId,
    state
  );

  if (
    vehicleState.priorityClass === "emergency" ||
    preferredRouteLoad < config.loadThreshold
  ) {
    vehicleState.assignedRouteId = vehicleState.preferredRouteId;

    return false;
  }

  const assignedRouteId = pickLeastLoadedRoute(config, state);
  vehicleState.assignedRouteId = assignedRouteId;

  if (assignedRouteId === vehicleState.preferredRouteId) {
    return false;
  }

  vehicleState.wasRedirected = true;
  state.totalRedirectedVehicles += 1;
  state.redirectedCountByRouteId[assignedRouteId] += 1;

  return true;
}

function enqueueArrivalsForTick(
  config: EdsaOverloadSimulationConfig,
  state: MutableSimulationState,
  tick: number
) {
  const redirectedVehicleIds: string[] = [];

  config.vehicles.forEach((vehicle) => {
    if (vehicle.arrivalTick !== tick) {
      return;
    }

    const wasRedirected = assignArrivalRoute(config, state, vehicle.id);
    const assignedRouteId = state.vehicleStates[vehicle.id].assignedRouteId;
    state.routeQueues[assignedRouteId].push(vehicle.id);

    if (wasRedirected) {
      redirectedVehicleIds.push(vehicle.id);
    }
  });

  return redirectedVehicleIds;
}

function findHighestPriorityWaitingVehicle(
  state: MutableSimulationState
) {
  const queuedVehicleIds = state.routeSequence
    .flatMap((routeId) => state.routeQueues[routeId])
    .sort((firstVehicleId, secondVehicleId) =>
      compareQueuedVehicles(state, firstVehicleId, secondVehicleId)
    );

  return queuedVehicleIds[0] ?? null;
}

function shouldPreemptActiveVehicle(state: MutableSimulationState) {
  if (!state.activeVehicleId) {
    return null;
  }

  const activeVehicle = state.vehicleStates[state.activeVehicleId];
  const waitingVehicleId = findHighestPriorityWaitingVehicle(state);

  if (!waitingVehicleId) {
    return null;
  }

  const waitingVehicle = state.vehicleStates[waitingVehicleId];

  return getPriorityRank(waitingVehicle.priorityClass) >
    getPriorityRank(activeVehicle.priorityClass)
    ? waitingVehicleId
    : null;
}

function selectNextVehicle(state: MutableSimulationState) {
  const nextVehicleId = findHighestPriorityWaitingVehicle(state);

  if (!nextVehicleId) {
    return null;
  }

  const nextVehicle = state.vehicleStates[nextVehicleId];
  state.routeQueues[nextVehicle.assignedRouteId] = state.routeQueues[
    nextVehicle.assignedRouteId
  ].filter((vehicleId) => vehicleId !== nextVehicleId);
  nextVehicle.currentWaitTicks = 0;

  return nextVehicleId;
}

function incrementWaitingVehicles(state: MutableSimulationState) {
  state.routeSequence.forEach((routeId) => {
    state.routeQueues[routeId].forEach((vehicleId) => {
      const vehicle = state.vehicleStates[vehicleId];
      vehicle.currentWaitTicks += 1;
      vehicle.totalWaitTicks += 1;
    });
  });
}

function snapshotQueues(state: MutableSimulationState) {
  return Object.fromEntries(
    state.routeSequence.map((routeId) => [routeId, listOrderedQueue(state, routeId)])
  ) as Record<CorridorRouteId, string[]>;
}

function snapshotQueueLengths(
  queueByRouteId: Record<CorridorRouteId, string[]>
) {
  return Object.fromEntries(
    Object.entries(queueByRouteId).map(([routeId, vehicleIds]) => [
      routeId,
      vehicleIds.length
    ])
  ) as Record<CorridorRouteId, number>;
}

function snapshotAverageWaits(
  state: MutableSimulationState,
  queueByRouteId: Record<CorridorRouteId, string[]>
) {
  return Object.fromEntries(
    state.routeSequence.map((routeId) => {
      const vehicleIds = queueByRouteId[routeId];

      if (vehicleIds.length === 0) {
        return [routeId, 0];
      }

      const totalWait = vehicleIds.reduce((sum, vehicleId) => {
        return sum + state.vehicleStates[vehicleId].currentWaitTicks;
      }, 0);

      return [routeId, totalWait / vehicleIds.length];
    })
  ) as Record<CorridorRouteId, number>;
}

function snapshotWaitByVehicle(state: MutableSimulationState) {
  return Object.fromEntries(
    Object.values(state.vehicleStates)
      .sort((firstVehicle, secondVehicle) =>
        firstVehicle.id.localeCompare(secondVehicle.id)
      )
      .map((vehicle) => [vehicle.id, vehicle.currentWaitTicks])
  );
}

function pushTimelineSnapshot(
  state: MutableSimulationState,
  tick: number,
  reason: CorridorSimulationReason | null,
  preemptedVehicleId: string | null,
  redirectedVehicleIds: string[],
  activeVehicleIdForTick: string | null,
  activeRemainingServiceTicks: number
) {
  const queueByRouteId = snapshotQueues(state);
  const queueLengthByRouteId = snapshotQueueLengths(queueByRouteId);
  const averageWaitByRouteId = snapshotAverageWaits(state, queueByRouteId);
  const waitByVehicleId = snapshotWaitByVehicle(state);
  const activeVehicle = activeVehicleIdForTick
    ? state.vehicleStates[activeVehicleIdForTick]
    : null;

  state.timeline.push({
    tick,
    activeVehicleId: activeVehicleIdForTick,
    activeRouteId: activeVehicle?.assignedRouteId ?? null,
    activePriorityClass: activeVehicle?.priorityClass ?? null,
    reason,
    preemptedVehicleId,
    redirectedVehicleIds,
    totalRedirectedVehicles: state.totalRedirectedVehicles,
    completedVehicles: state.completedVehicles,
    activeRemainingServiceTicks,
    queueByRouteId,
    queueLengthByRouteId,
    averageWaitByRouteId,
    waitByVehicleId
  });
}

export function runEdsaOverloadSimulation(
  config: EdsaOverloadSimulationConfig
): EdsaOverloadSimulationResult {
  assertValidConfig(config);

  const state: MutableSimulationState = {
    activeVehicleId: null,
    completedVehicles: 0,
    redirectedCountByRouteId: buildQueueRecord(config.routes, () => 0),
    routeQueues: buildQueueRecord(config.routes, () => []),
    routeSequence: config.routes.map((route) => route.id),
    timeline: [],
    totalRedirectedVehicles: 0,
    vehicleStates: Object.fromEntries(
      config.vehicles.map((vehicle) => [vehicle.id, createVehicleState(vehicle)])
    )
  };

  for (let tick = 0; tick < config.ticks; tick += 1) {
    const redirectedVehicleIds = enqueueArrivalsForTick(config, state, tick);
    let preemptedVehicleId: string | null = null;

    if (config.preemptionEnabled) {
      const preemptingVehicleId = shouldPreemptActiveVehicle(state);

      if (preemptingVehicleId && state.activeVehicleId) {
        preemptedVehicleId = state.activeVehicleId;
        const activeVehicle = state.vehicleStates[state.activeVehicleId];
        state.routeQueues[activeVehicle.assignedRouteId].push(activeVehicle.id);
        state.activeVehicleId = null;
      }
    }

    let reason: CorridorSimulationReason | null = null;

    if (!state.activeVehicleId) {
      state.activeVehicleId = selectNextVehicle(state);

      if (state.activeVehicleId) {
        reason = preemptedVehicleId ? "preempted" : "dispatch";
      }
    } else {
      reason = "continue-service";
    }

    const activeVehicle = state.activeVehicleId
      ? state.vehicleStates[state.activeVehicleId]
      : null;
    let activeVehicleIdForTick: string | null = null;
    let activeRemainingServiceTicks = 0;

    if (activeVehicle) {
      activeVehicleIdForTick = activeVehicle.id;
      activeVehicle.remainingServiceTicks -= 1;
      activeRemainingServiceTicks = activeVehicle.remainingServiceTicks;

      if (activeVehicle.remainingServiceTicks === 0) {
        activeVehicle.completedAtTick = tick;
        state.completedVehicles += 1;
        state.activeVehicleId = null;
      }
    }

    incrementWaitingVehicles(state);
    pushTimelineSnapshot(
      state,
      tick,
      reason,
      preemptedVehicleId,
      redirectedVehicleIds,
      activeVehicleIdForTick,
      activeRemainingServiceTicks
    );
  }

  return {
    timeline: state.timeline,
    vehicles: state.vehicleStates,
    redirectedCountByRouteId: state.redirectedCountByRouteId
  };
}
