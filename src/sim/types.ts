export type Stop = {
  id: string;
  name: string;
};

export type Route = {
  id: string;
  name: string;
  stops: Stop[];
};

export type Jeepney = {
  id: string;
  label: string;
  initialStopIndex?: number;
  initialWaitTicks?: number;
};

export type SimulationReason =
  | "dispatch"
  | "continue-quantum"
  | "quantum-expired"
  | "aging-boost";

export type SchedulingEvent = {
  tick: number;
  activeJeepneyId: string;
  stopId: string;
  stopIndex: number;
  queue: string[];
  reason: SimulationReason;
  quantumUsed: number;
};

export type MetricsSnapshot = {
  tick: number;
  activeJeepneyId: string;
  throughput: number;
  totalWaitTime: number;
  averageWaitTime: number;
  contextSwitches: number;
  starvationRisk: number;
  queue: string[];
};

export type JeepneySimulationConfig = {
  route: Route;
  jeepneys: Jeepney[];
  ticks: number;
  timeQuantum: number;
  agingThreshold?: number;
  agingEnabled?: boolean;
};

export type JeepneyState = {
  id: string;
  label: string;
  nextStopIndex: number;
  completedStops: number;
  totalWaitTicks: number;
  currentWaitTicks: number;
  agingBoosts: number;
};

export type JeepneySimulationResult = {
  events: SchedulingEvent[];
  metrics: MetricsSnapshot[];
  jeepneys: Record<string, JeepneyState>;
};
