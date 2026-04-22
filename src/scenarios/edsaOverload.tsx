import { useEffect, useState } from "react";
import { runEdsaOverloadSimulation } from "../sim/edsaOverloadScheduler";
import type {
  CorridorRoute,
  CorridorRouteId,
  CorridorTickSnapshot,
  CorridorVehicle,
  CorridorVehicleState,
  EdsaOverloadSimulationConfig,
  VehiclePriorityClass
} from "../sim/edsaOverloadTypes";
import type { ScenarioStageProps } from "./types";

type CorridorControls = {
  loadThreshold: number;
  rushHourBurst: number;
};

type RouteCard = CorridorRoute & {
  averageWait: number;
  currentActiveVehicle: CorridorVehicleState | null;
  queueIds: string[];
  redirectedVehicles: number;
};

type ConceptCard = {
  title: string;
  tag: string;
  body: string;
};

const corridorRoutes: CorridorRoute[] = [
  { id: "edsa", name: "EDSA" },
  { id: "c5", name: "C5" },
  { id: "quirino", name: "Quirino" }
];

const defaultControls: CorridorControls = {
  loadThreshold: 2,
  rushHourBurst: 2
};

const tickDurationMs = 950;

function buildVehicles(rushHourBurst: number): CorridorVehicle[] {
  return [
    {
      id: "bus-1",
      label: "Bus 01",
      priorityClass: "bus",
      preferredRouteId: "edsa",
      arrivalTick: 0,
      serviceTicks: 3
    },
    {
      id: "car-1",
      label: "Car 14",
      priorityClass: "private",
      preferredRouteId: "edsa",
      arrivalTick: 0,
      serviceTicks: 2
    },
    {
      id: "jeep-1",
      label: "Jeep 3",
      priorityClass: "jeepney",
      preferredRouteId: "c5",
      arrivalTick: 0,
      serviceTicks: 1
    },
    {
      id: "bus-2",
      label: "Bus 05",
      priorityClass: "bus",
      preferredRouteId: "edsa",
      arrivalTick: 1,
      serviceTicks: 2
    },
    {
      id: "ambulance-1",
      label: "Ambulance 2",
      priorityClass: "emergency",
      preferredRouteId: "edsa",
      arrivalTick: 2,
      serviceTicks: 2
    },
    {
      id: "jeep-2",
      label: "Jeep 7",
      priorityClass: "jeepney",
      preferredRouteId: "edsa",
      arrivalTick: 2,
      serviceTicks: 1
    },
    {
      id: "car-quirino",
      label: "Sedan 9",
      priorityClass: "private",
      preferredRouteId: "quirino",
      arrivalTick: 3,
      serviceTicks: 1
    },
    ...Array.from({ length: rushHourBurst }, (_, index) => ({
      id: `burst-${index + 1}`,
      label: `Rush ${index + 1}`,
      priorityClass: "private" as const,
      preferredRouteId: "edsa" as const,
      arrivalTick: index + 1,
      serviceTicks: 1
    }))
  ];
}

function buildSimulationConfig(
  controls: CorridorControls,
  preemptionEnabled: boolean
): EdsaOverloadSimulationConfig {
  return {
    routes: corridorRoutes,
    vehicles: buildVehicles(controls.rushHourBurst),
    ticks: 11 + controls.rushHourBurst,
    loadThreshold: controls.loadThreshold,
    preemptionEnabled
  };
}

function formatWaitTime(value: number) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(1);
}

function formatPriority(priorityClass: VehiclePriorityClass | null) {
  switch (priorityClass) {
    case "emergency":
      return "Emergency";
    case "bus":
      return "Bus";
    case "jeepney":
      return "Jeepney";
    case "private":
      return "Private";
    default:
      return "Idle";
  }
}

function formatDispatchReason(
  snapshot: CorridorTickSnapshot,
  vehicles: Record<string, CorridorVehicleState>
) {
  if (!snapshot.reason || !snapshot.activeVehicleId) {
    return "Dispatcher idle";
  }

  const activeVehicle = vehicles[snapshot.activeVehicleId];

  switch (snapshot.reason) {
    case "preempted":
      return `${activeVehicle.label} jumped lane`;
    case "continue-service":
      return `${activeVehicle.label} kept slot`;
    case "dispatch":
      return `${activeVehicle.label} freshly dispatched`;
    default:
      return "Dispatcher active";
  }
}

function describeDispatch(
  snapshot: CorridorTickSnapshot,
  vehicles: Record<string, CorridorVehicleState>
) {
  if (!snapshot.activeVehicleId || !snapshot.activeRouteId) {
    return "No vehicle dispatched on this tick.";
  }

  const activeVehicle = vehicles[snapshot.activeVehicleId];
  const completionCopy =
    snapshot.activeRemainingServiceTicks === 0
      ? "Completed this tick."
      : `${snapshot.activeRemainingServiceTicks} service ticks remain.`;

  if (snapshot.reason === "preempted" && snapshot.preemptedVehicleId) {
    return `${activeVehicle.label} preempted ${
      vehicles[snapshot.preemptedVehicleId].label
    } on ${snapshot.activeRouteId.toUpperCase()}. ${completionCopy}`;
  }

  return `${activeVehicle.label} served ${snapshot.activeRouteId.toUpperCase()} as ${
    formatPriority(snapshot.activePriorityClass).toLowerCase()
  } traffic. ${completionCopy}`;
}

function buildRouteCards(
  snapshot: CorridorTickSnapshot,
  vehicles: Record<string, CorridorVehicleState>,
  redirectedCountByRouteId: Record<CorridorRouteId, number>
): RouteCard[] {
  return corridorRoutes.map((route) => ({
    ...route,
    averageWait: snapshot.averageWaitByRouteId[route.id],
    currentActiveVehicle:
      snapshot.activeRouteId === route.id && snapshot.activeVehicleId
        ? vehicles[snapshot.activeVehicleId]
        : null,
    queueIds: snapshot.queueByRouteId[route.id],
    redirectedVehicles: redirectedCountByRouteId[route.id]
  }));
}

function countQueuedVehicles(snapshot: CorridorTickSnapshot) {
  return Object.values(snapshot.queueLengthByRouteId).reduce(
    (total, queueLength) => total + queueLength,
    0
  );
}

function findMostLoadedRoute(snapshot: CorridorTickSnapshot) {
  return corridorRoutes.reduce((mostLoadedRoute, route) => {
    if (
      snapshot.queueLengthByRouteId[route.id] >
      snapshot.queueLengthByRouteId[mostLoadedRoute.id]
    ) {
      return route;
    }

    return mostLoadedRoute;
  }, corridorRoutes[0]);
}

function buildConceptCards(
  snapshot: CorridorTickSnapshot,
  vehicles: Record<string, CorridorVehicleState>,
  controls: CorridorControls,
  preemptionEnabled: boolean
): ConceptCard[] {
  const redirectedLabels = snapshot.redirectedVehicleIds.map((vehicleId) => {
    const vehicle = vehicles[vehicleId];

    return `${vehicle.label} -> ${vehicle.assignedRouteId.toUpperCase()}`;
  });

  return [
    {
      title: "Priority ladder",
      tag: "Priority scheduling",
      body: `Emergency > bus > jeepney > private. Current dispatch class: ${formatPriority(
        snapshot.activePriorityClass
      )}.`
    },
    {
      title: "Preemption switch",
      tag: "Optional preemption",
      body: preemptionEnabled
        ? snapshot.preemptedVehicleId
          ? `${vehicles[snapshot.preemptedVehicleId].label} got bumped when higher-priority traffic arrived.`
          : "Enabled. Active work can be interrupted by a higher-priority arrival."
        : "Disabled. Current work holds lane until it finishes."
    },
    {
      title: "Load threshold",
      tag: "Load balancing",
      body: `Threshold set to ${controls.loadThreshold} queued-or-running vehicles per route. New arrivals reroute once preferred lane crosses it.`
    },
    {
      title: "Redirect feed",
      tag: "Congestion response",
      body:
        redirectedLabels.length > 0
          ? redirectedLabels.join(", ")
          : "No new reroutes on this tick."
    }
  ];
}

function getVehicleChipLabel(
  snapshot: CorridorTickSnapshot,
  vehicles: Record<string, CorridorVehicleState>,
  vehicleId: string
) {
  const vehicle = vehicles[vehicleId];
  const waitTicks = snapshot.waitByVehicleId[vehicleId] ?? 0;

  return `${vehicle.label} ${waitTicks}t`;
}

export function EdsaOverloadStage({ scenario }: ScenarioStageProps) {
  const [controls, setControls] = useState(defaultControls);
  const [preemptionEnabled, setPreemptionEnabled] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const simulationConfig = buildSimulationConfig(controls, preemptionEnabled);
  const simulationResult = runEdsaOverloadSimulation(simulationConfig);
  const totalSteps = simulationResult.timeline.length;
  const currentIndex = Math.min(currentStep, Math.max(totalSteps - 1, 0));
  const currentSnapshot = simulationResult.timeline[currentIndex];
  const routeCards = buildRouteCards(
    currentSnapshot,
    simulationResult.vehicles,
    simulationResult.redirectedCountByRouteId
  );
  const conceptCards = buildConceptCards(
    currentSnapshot,
    simulationResult.vehicles,
    controls,
    preemptionEnabled
  );
  const mostLoadedRoute = findMostLoadedRoute(currentSnapshot);
  const progressPercent =
    totalSteps <= 1 ? 100 : (currentIndex / (totalSteps - 1)) * 100;

  useEffect(() => {
    setCurrentStep(0);
    setHasStarted(false);
    setIsRunning(false);
  }, [controls.loadThreshold, controls.rushHourBurst, preemptionEnabled]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    if (currentIndex >= totalSteps - 1) {
      setIsRunning(false);

      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentStep((step) => Math.min(step + 1, totalSteps - 1));
    }, tickDurationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentIndex, isRunning, totalSteps]);

  return (
    <>
      <div className="control-bar">
        <div className="control-buttons">
          <button
            className="control-button primary"
            onClick={() => {
              setHasStarted(true);
              setIsRunning(true);
            }}
            type="button"
          >
            {hasStarted ? "Resume" : "Start"}
          </button>
          <button
            className="control-button"
            disabled={!hasStarted || !isRunning}
            onClick={() => {
              setIsRunning(false);
            }}
            type="button"
          >
            Pause
          </button>
          <button
            className="control-button"
            disabled={!hasStarted && currentIndex === 0}
            onClick={() => {
              setCurrentStep(0);
              setHasStarted(false);
              setIsRunning(false);
            }}
            type="button"
          >
            Reset
          </button>
          <button
            className={`control-button ${preemptionEnabled ? "" : "primary"}`}
            onClick={() => {
              setPreemptionEnabled((current) => !current);
            }}
            type="button"
          >
            Preemption {preemptionEnabled ? "On" : "Off"}
          </button>
        </div>

        <div className="timeline-readout">
          <div className="timeline-copy">
            <strong>
              Tick {currentSnapshot.tick} / {Math.max(totalSteps - 1, 0)}
            </strong>
            <span>
              {formatDispatchReason(currentSnapshot, simulationResult.vehicles)}
            </span>
          </div>
          <div className="timeline-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <section className="learning-controls" aria-label="EDSA overload controls">
        <div className="panel-section-header">
          <div>
            <p className="eyebrow">Phase 5 tuning</p>
            <h3>Corridor load balancer</h3>
          </div>
          <p>
            Shift congestion threshold and rush-hour burst, then watch routing
            move arrivals across EDSA, C5, and Quirino.
          </p>
        </div>

        <div className="learning-control-grid edsa-control-grid">
          <label className="learning-control">
            <span>Load threshold</span>
            <strong>{controls.loadThreshold} vehicles</strong>
            <input
              max={4}
              min={1}
              onChange={(event) => {
                setControls((current) => ({
                  ...current,
                  loadThreshold: Number(event.target.value)
                }));
              }}
              type="range"
              value={controls.loadThreshold}
            />
          </label>

          <label className="learning-control">
            <span>Rush-hour burst</span>
            <strong>{controls.rushHourBurst} extra EDSA arrivals</strong>
            <input
              max={3}
              min={0}
              onChange={(event) => {
                setControls((current) => ({
                  ...current,
                  rushHourBurst: Number(event.target.value)
                }));
              }}
              type="range"
              value={controls.rushHourBurst}
            />
          </label>

          <article className="learning-control learning-control-static">
            <span>Preemption mode</span>
            <strong>{preemptionEnabled ? "Emergency can seize lane" : "Active work cannot be interrupted"}</strong>
            <p>
              Toggle button above flips between strict priority scheduling and
              finish-what-started service.
            </p>
          </article>
        </div>
      </section>

      <div className="live-grid">
        <section className="route-preview" aria-label="Route queue pressure">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">Route queues</p>
              <h3>EDSA, C5, Quirino</h3>
            </div>
            <p>
              Queue chips show current waits in ticks. Active route gets lifted
              while congested routes push new arrivals away.
            </p>
          </div>

          <div className="corridor-route-grid">
            {routeCards.map((route) => (
              <article
                className={`corridor-route-card is-${route.id} ${
                  route.currentActiveVehicle ? "is-active" : ""
                }`}
                key={route.id}
              >
                <div className="corridor-route-header">
                  <div>
                    <span>{route.name}</span>
                    <h4>{currentSnapshot.queueLengthByRouteId[route.id]} queued</h4>
                  </div>
                  <strong>{formatWaitTime(route.averageWait)}t avg wait</strong>
                </div>

                <p className="corridor-route-active">
                  {route.currentActiveVehicle
                    ? `${route.currentActiveVehicle.label} running now`
                    : "No active dispatch on this route"}
                </p>

                <div className="corridor-queue-chips">
                  {route.queueIds.map((vehicleId) => {
                    const vehicle = simulationResult.vehicles[vehicleId];

                    return (
                      <span
                        className={`vehicle-chip is-${vehicle.priorityClass}`}
                        key={vehicleId}
                      >
                        {getVehicleChipLabel(
                          currentSnapshot,
                          simulationResult.vehicles,
                          vehicleId
                        )}
                      </span>
                    );
                  })}

                  {route.queueIds.length === 0 ? (
                    <span className="vehicle-chip is-empty">Queue clear</span>
                  ) : null}
                </div>

                <dl className="corridor-route-metrics">
                  <div>
                    <dt>Redirected in</dt>
                    <dd>{route.redirectedVehicles}</dd>
                  </div>
                  <div>
                    <dt>Priority head</dt>
                    <dd>
                      {route.queueIds[0]
                        ? formatPriority(
                            simulationResult.vehicles[route.queueIds[0]].priorityClass
                          )
                        : "None"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <aside className="queue-panel" aria-label="Dispatcher state">
          <div className="queue-panel-header">
            <p className="eyebrow">Central dispatcher</p>
            <h3>Scheduling output</h3>
          </div>

          <div className="queue-active-card">
            <span>Running now</span>
            <strong>
              {currentSnapshot.activeVehicleId
                ? simulationResult.vehicles[currentSnapshot.activeVehicleId].label
                : "Dispatcher idle"}
            </strong>
            <p>{describeDispatch(currentSnapshot, simulationResult.vehicles)}</p>
          </div>

          <div className="queue-list">
            <article className="queue-item">
              <span>Mode</span>
              <div>
                <strong>{preemptionEnabled ? "Preemption armed" : "Preemption disabled"}</strong>
                <p>
                  {preemptionEnabled
                    ? "Emergency arrivals can interrupt lower-priority work."
                    : "Current vehicle finishes before higher-priority work runs."}
                </p>
              </div>
            </article>

            <article className="queue-item">
              <span>Redirects</span>
              <div>
                <strong>{currentSnapshot.redirectedVehicleIds.length} this tick</strong>
                <p>
                  {currentSnapshot.redirectedVehicleIds.length > 0
                    ? currentSnapshot.redirectedVehicleIds
                        .map((vehicleId) => {
                          const vehicle = simulationResult.vehicles[vehicleId];

                          return `${vehicle.label} -> ${vehicle.assignedRouteId.toUpperCase()}`;
                        })
                        .join(", ")
                    : "No fresh reroutes on this tick."}
                </p>
              </div>
            </article>

            <article className="queue-item">
              <span>Hot route</span>
              <div>
                <strong>{mostLoadedRoute.name}</strong>
                <p>
                  {currentSnapshot.queueLengthByRouteId[mostLoadedRoute.id]} vehicles
                  waiting, {formatWaitTime(currentSnapshot.averageWaitByRouteId[mostLoadedRoute.id])}
                  t average wait.
                </p>
              </div>
            </article>
          </div>

          <dl className="metric-list">
            <div>
              <dt>Total queued</dt>
              <dd>{countQueuedVehicles(currentSnapshot)}</dd>
            </div>
            <div>
              <dt>Total redirected</dt>
              <dd>{currentSnapshot.totalRedirectedVehicles}</dd>
            </div>
            <div>
              <dt>Completed vehicles</dt>
              <dd>{currentSnapshot.completedVehicles}</dd>
            </div>
            <div>
              <dt>Active class</dt>
              <dd>{formatPriority(currentSnapshot.activePriorityClass)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="panel-grid">
        <section className="info-panel">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">OS mapping</p>
              <h3>Priority and load balancing</h3>
            </div>
            <p>Every card reads from current tick, not hard-coded notes.</p>
          </div>

          <div className="concept-grid">
            {conceptCards.map((card) => (
              <article className="concept-card" key={card.title}>
                <span>{card.tag}</span>
                <h4>{card.title}</h4>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="info-panel">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">Scenario note</p>
              <h3>Why corridor pressure matters</h3>
            </div>
            <p>
              Same workspace shell now hosts live multi-queue scheduling instead
              of placeholder content.
            </p>
          </div>

          <div className="note-stack">
            <p>{scenario.description}</p>
            <p>
              EDSA acts like overloaded ready queue. C5 and Quirino become
              balancing targets once threshold trips.
            </p>
            <p>
              Emergency vehicles prove strict priority. Preemption toggle shows
              difference between interruptible and non-interruptible service.
            </p>
          </div>
        </section>
      </div>

      <section className="gantt-panel" aria-label="Dispatch trace">
        <div className="panel-section-header">
          <div>
            <p className="eyebrow">Tick-by-tick trace</p>
            <h3>Corridor scheduler log</h3>
          </div>
          <p>Highlighted card marks current playback tick.</p>
        </div>

        <div className="dispatch-trace-grid">
          {simulationResult.timeline.map((snapshot) => (
            <article
              className={`dispatch-trace-card ${
                snapshot.tick === currentSnapshot.tick ? "is-current" : ""
              }`}
              key={snapshot.tick}
            >
              <span>T{snapshot.tick}</span>
              <strong>
                {snapshot.activeVehicleId
                  ? simulationResult.vehicles[snapshot.activeVehicleId].label
                  : "Idle"}
              </strong>
              <p>{describeDispatch(snapshot, simulationResult.vehicles)}</p>
              <div className="dispatch-trace-meta">
                <span>{formatPriority(snapshot.activePriorityClass)}</span>
                <span>
                  {snapshot.activeRouteId
                    ? snapshot.activeRouteId.toUpperCase()
                    : "Standby"}
                </span>
                <span>{snapshot.totalRedirectedVehicles} redirected total</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
