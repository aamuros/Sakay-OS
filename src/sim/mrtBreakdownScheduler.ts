import type {
  MrtBreakdownSimulationConfig,
  MrtBreakdownSimulationResult,
  MrtRecoveryStatus,
  MrtTickSnapshot
} from "./mrtBreakdownTypes";

type MutableMrtState = {
  migrationTimeTicks: number;
  passengerQueues: Record<string, number>;
  totalDroppedPassengers: number;
  totalMigratedPassengers: number;
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

function assertValidConfig(config: MrtBreakdownSimulationConfig) {
  if (config.stations.length === 0) {
    throw new Error("MRT simulation must include at least one station.");
  }

  assertUniqueIds(
    config.stations.map((station) => station.id),
    "Station"
  );
  assertUniqueIds(
    config.backupRoutes.map((route) => route.id),
    "Backup route"
  );

  assertWholeNumber(config.ticks, "Ticks");

  if (config.ticks < 0) {
    throw new Error("Ticks must be zero or greater.");
  }

  assertWholeNumber(config.passengerArrivalRate, "Passenger arrival rate");

  if (config.passengerArrivalRate < 0) {
    throw new Error("Passenger arrival rate must be zero or greater.");
  }

  assertWholeNumber(config.primaryCapacityPerTick, "Primary capacity");

  if (config.primaryCapacityPerTick <= 0) {
    throw new Error("Primary capacity must be greater than zero.");
  }

  assertWholeNumber(config.degradedCapacityPerTick, "Degraded capacity");

  if (config.degradedCapacityPerTick < 0) {
    throw new Error("Degraded capacity must be zero or greater.");
  }

  if (config.degradedCapacityPerTick > config.primaryCapacityPerTick) {
    throw new Error("Degraded capacity cannot exceed primary capacity.");
  }

  assertWholeNumber(config.dropThreshold, "Drop threshold");

  if (config.dropThreshold <= 0) {
    throw new Error("Drop threshold must be greater than zero.");
  }

  config.backupRoutes.forEach((route) => {
    assertWholeNumber(route.capacityPerTick, "Backup route capacity");

    if (route.capacityPerTick < 0) {
      throw new Error("Backup route capacity must be zero or greater.");
    }
  });

  if (!config.fault) {
    return;
  }

  const stationIds = new Set(config.stations.map((station) => station.id));

  if (!stationIds.has(config.fault.stationId)) {
    throw new Error(`Unknown fault station id: ${config.fault.stationId}.`);
  }

  assertWholeNumber(config.fault.startTick, "Fault start tick");
  assertWholeNumber(config.fault.recoveryTick, "Recovery tick");

  if (config.fault.startTick < 0) {
    throw new Error("Fault start tick must be zero or greater.");
  }

  if (config.fault.recoveryTick <= config.fault.startTick) {
    throw new Error("Recovery tick must be after fault start tick.");
  }
}

function buildPassengerQueues(config: MrtBreakdownSimulationConfig) {
  return Object.fromEntries(config.stations.map((station) => [station.id, 0]));
}

function addPassengerArrivals(
  config: MrtBreakdownSimulationConfig,
  state: MutableMrtState,
  tick: number
) {
  config.stations.forEach((station, index) => {
    const surge = (tick + index) % 4 === 0 ? 1 : 0;
    state.passengerQueues[station.id] += config.passengerArrivalRate + surge;
  });
}

function isFaultActive(config: MrtBreakdownSimulationConfig, tick: number) {
  return (
    config.fault !== null &&
    tick >= config.fault.startTick &&
    tick < config.fault.recoveryTick
  );
}

function isRecoveryTick(config: MrtBreakdownSimulationConfig, tick: number) {
  return config.fault !== null && tick === config.fault.recoveryTick;
}

function servePrimaryPassengers(
  config: MrtBreakdownSimulationConfig,
  state: MutableMrtState,
  failedStationId: string | null
) {
  let remainingCapacity =
    failedStationId === null
      ? config.primaryCapacityPerTick
      : config.degradedCapacityPerTick;
  const onlineStations = config.stations.filter(
    (station) => station.id !== failedStationId
  );
  let servedPassengers = 0;
  let cursor = 0;

  while (
    remainingCapacity > 0 &&
    onlineStations.some((station) => state.passengerQueues[station.id] > 0)
  ) {
    const station = onlineStations[cursor % onlineStations.length];

    if (state.passengerQueues[station.id] > 0) {
      state.passengerQueues[station.id] -= 1;
      remainingCapacity -= 1;
      servedPassengers += 1;
    }

    cursor += 1;
  }

  return servedPassengers;
}

function buildBackupRouteLoads(config: MrtBreakdownSimulationConfig) {
  return Object.fromEntries(
    config.backupRoutes.map((route) => [route.id, 0])
  );
}

function getFailedStationQueue(
  state: MutableMrtState,
  failedStationId: string | null
) {
  if (!failedStationId) {
    return 0;
  }

  return state.passengerQueues[failedStationId];
}

function assignBackupCapacity(
  config: MrtBreakdownSimulationConfig,
  waitingPassengers: number
) {
  const backupRouteLoads = buildBackupRouteLoads(config);
  let remainingPassengers = waitingPassengers;
  let migratedPassengers = 0;

  config.backupRoutes.forEach((route) => {
    if (remainingPassengers <= 0) {
      return;
    }

    const routeLoad = Math.min(remainingPassengers, route.capacityPerTick);
    backupRouteLoads[route.id] = routeLoad;
    remainingPassengers -= routeLoad;
    migratedPassengers += routeLoad;
  });

  return {
    backupRouteLoads,
    migratedPassengers,
    remainingPassengers
  };
}

function migratePassengers(
  config: MrtBreakdownSimulationConfig,
  state: MutableMrtState,
  failedStationId: string | null
) {
  if (!failedStationId) {
    return {
      backupRouteLoads: buildBackupRouteLoads(config),
      migratedPassengers: 0
    };
  }

  const { backupRouteLoads, migratedPassengers, remainingPassengers } =
    assignBackupCapacity(
      config,
      getFailedStationQueue(state, failedStationId)
    );

  state.passengerQueues[failedStationId] = remainingPassengers;
  state.totalMigratedPassengers += migratedPassengers;

  if (migratedPassengers > 0) {
    state.migrationTimeTicks += 1;
  }

  return {
    backupRouteLoads,
    migratedPassengers
  };
}

function dropOverflowPassengers(
  config: MrtBreakdownSimulationConfig,
  state: MutableMrtState,
  failedStationId: string | null
) {
  if (!failedStationId) {
    return 0;
  }

  const overflow = Math.max(
    state.passengerQueues[failedStationId] - config.dropThreshold,
    0
  );

  if (overflow === 0) {
    return 0;
  }

  state.passengerQueues[failedStationId] -= overflow;
  state.totalDroppedPassengers += overflow;

  return overflow;
}

function getRecoveryStatus(
  config: MrtBreakdownSimulationConfig,
  tick: number,
  failedStationId: string | null
): MrtRecoveryStatus {
  if (!config.fault) {
    return "normal";
  }

  if (failedStationId) {
    return tick === config.fault.recoveryTick - 1 ? "recovering" : "degraded";
  }

  if (tick >= config.fault.recoveryTick) {
    return "recovered";
  }

  return "normal";
}

function getServiceLevelPercent(
  config: MrtBreakdownSimulationConfig,
  failedStationId: string | null
) {
  if (!failedStationId) {
    return 100;
  }

  return Math.round(
    (config.degradedCapacityPerTick / config.primaryCapacityPerTick) * 100
  );
}

function getSnapshotEvent(
  config: MrtBreakdownSimulationConfig,
  tick: number,
  failedStationId: string | null,
  migratedPassengers: number,
  droppedPassengers: number
): MrtTickSnapshot["event"] {
  if (config.fault?.startTick === tick) {
    return "fault-injected";
  }

  if (droppedPassengers > 0) {
    return "passengers-dropped";
  }

  if (isRecoveryTick(config, tick)) {
    return "service-restored";
  }

  if (failedStationId && config.fault?.recoveryTick === tick + 1) {
    return "recovery-started";
  }

  if (migratedPassengers > 0) {
    return "migration-active";
  }

  return "normal-service";
}

export function runMrtBreakdownSimulation(
  config: MrtBreakdownSimulationConfig
): MrtBreakdownSimulationResult {
  assertValidConfig(config);

  const state: MutableMrtState = {
    migrationTimeTicks: 0,
    passengerQueues: buildPassengerQueues(config),
    totalDroppedPassengers: 0,
    totalMigratedPassengers: 0
  };
  const timeline: MrtTickSnapshot[] = [];

  for (let tick = 0; tick < config.ticks; tick += 1) {
    addPassengerArrivals(config, state, tick);

    const failedStationId = isFaultActive(config, tick)
      ? config.fault?.stationId ?? null
      : null;
    const primaryServedPassengers = servePrimaryPassengers(
      config,
      state,
      failedStationId
    );
    const { backupRouteLoads, migratedPassengers } = migratePassengers(
      config,
      state,
      failedStationId
    );
    const droppedPassengers = dropOverflowPassengers(
      config,
      state,
      failedStationId
    );

    timeline.push({
      tick,
      failedStationId,
      status: getRecoveryStatus(config, tick, failedStationId),
      serviceLevelPercent: getServiceLevelPercent(config, failedStationId),
      primaryServedPassengers,
      migratedPassengers,
      droppedPassengers,
      totalMigratedPassengers: state.totalMigratedPassengers,
      totalDroppedPassengers: state.totalDroppedPassengers,
      migrationTimeTicks: state.migrationTimeTicks,
      stationQueues: { ...state.passengerQueues },
      backupRouteLoads: { ...backupRouteLoads },
      event: getSnapshotEvent(
        config,
        tick,
        failedStationId,
        migratedPassengers,
        droppedPassengers
      )
    });
  }

  return { timeline };
}
