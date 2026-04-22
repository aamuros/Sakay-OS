export type CorridorRouteId = "edsa" | "c5" | "quirino";

export type VehiclePriorityClass =
  | "emergency"
  | "bus"
  | "jeepney"
  | "private";

export type CorridorRoute = {
  id: CorridorRouteId;
  name: string;
};

export type CorridorVehicle = {
  id: string;
  label: string;
  priorityClass: VehiclePriorityClass;
  preferredRouteId: CorridorRouteId;
  arrivalTick: number;
  serviceTicks: number;
};

export type CorridorSimulationReason =
  | "dispatch"
  | "continue-service"
  | "preempted";

export type CorridorVehicleState = {
  id: string;
  label: string;
  priorityClass: VehiclePriorityClass;
  preferredRouteId: CorridorRouteId;
  assignedRouteId: CorridorRouteId;
  arrivalTick: number;
  serviceTicks: number;
  remainingServiceTicks: number;
  totalWaitTicks: number;
  currentWaitTicks: number;
  wasRedirected: boolean;
  completedAtTick: number | null;
};

export type CorridorTickSnapshot = {
  tick: number;
  activeVehicleId: string | null;
  activeRouteId: CorridorRouteId | null;
  activePriorityClass: VehiclePriorityClass | null;
  reason: CorridorSimulationReason | null;
  preemptedVehicleId: string | null;
  redirectedVehicleIds: string[];
  totalRedirectedVehicles: number;
  completedVehicles: number;
  activeRemainingServiceTicks: number;
  queueByRouteId: Record<CorridorRouteId, string[]>;
  queueLengthByRouteId: Record<CorridorRouteId, number>;
  averageWaitByRouteId: Record<CorridorRouteId, number>;
  waitByVehicleId: Record<string, number>;
};

export type EdsaOverloadSimulationConfig = {
  routes: CorridorRoute[];
  vehicles: CorridorVehicle[];
  ticks: number;
  loadThreshold: number;
  preemptionEnabled: boolean;
};

export type EdsaOverloadSimulationResult = {
  timeline: CorridorTickSnapshot[];
  vehicles: Record<string, CorridorVehicleState>;
  redirectedCountByRouteId: Record<CorridorRouteId, number>;
};
