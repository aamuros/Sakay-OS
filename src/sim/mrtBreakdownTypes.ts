export type MrtRecoveryStatus = "normal" | "degraded" | "recovering" | "recovered";

export type MrtStation = {
  id: string;
  name: string;
};

export type MrtBackupRoute = {
  id: string;
  name: string;
  capacityPerTick: number;
};

export type MrtFaultConfig = {
  stationId: string;
  startTick: number;
  recoveryTick: number;
};

export type MrtBreakdownSimulationConfig = {
  stations: MrtStation[];
  backupRoutes: MrtBackupRoute[];
  ticks: number;
  passengerArrivalRate: number;
  primaryCapacityPerTick: number;
  degradedCapacityPerTick: number;
  dropThreshold: number;
  fault: MrtFaultConfig | null;
};

export type MrtTickSnapshot = {
  tick: number;
  failedStationId: string | null;
  status: MrtRecoveryStatus;
  serviceLevelPercent: number;
  primaryServedPassengers: number;
  migratedPassengers: number;
  droppedPassengers: number;
  totalMigratedPassengers: number;
  totalDroppedPassengers: number;
  migrationTimeTicks: number;
  stationQueues: Record<string, number>;
  backupRouteLoads: Record<string, number>;
  event:
    | "normal-service"
    | "fault-injected"
    | "migration-active"
    | "passengers-dropped"
    | "recovery-started"
    | "service-restored";
};

export type MrtBreakdownSimulationResult = {
  timeline: MrtTickSnapshot[];
};
