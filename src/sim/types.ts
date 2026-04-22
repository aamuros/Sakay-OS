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
  didContextSwitch: boolean;
  activeWaitTicks: number;
  servedPassengers: number;
  passengerBacklog: number;
  busiestStopId: string | null;
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
  atRiskJeepneyIds: string[];
  waitByJeepneyId: Record<string, number>;
  passengerBacklog: number;
  stopPassengerQueues: Record<string, number>;
  busiestStopId: string | null;
  servedPassengers: number;
  totalPassengersServed: number;
};

export type JeepneySimulationConfig = {
  route: Route;
  jeepneys: Jeepney[];
  ticks: number;
  timeQuantum: number;
  agingThreshold?: number;
  agingEnabled?: boolean;
  passengerArrivalRate?: number;
  passengerBoardingRate?: number;
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
