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

function formatRouteLabel(routeId: CorridorRouteId | null) {
  return routeId ? routeId.toUpperCase() : "Standby";
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

function formatRedirectSummary(
  snapshot: CorridorTickSnapshot,
  vehicles: Record<string, CorridorVehicleState>
) {
  if (snapshot.redirectedVehicleIds.length === 0) {
    return "No new redirects";
  }

  return snapshot.redirectedVehicleIds
    .map((vehicleId) => {
      const vehicle = vehicles[vehicleId];

      return `${vehicle.label} to ${formatRouteLabel(vehicle.assignedRouteId)}`;
    })
    .join(", ");
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

function getRoutePressureStatus(route: RouteCard, threshold: number) {
  const waitingCount = route.queueIds.length;

  if (route.id === "edsa") {
    if (waitingCount > threshold) {
      return "Over threshold";
    }

    if (waitingCount === threshold) {
      return "At threshold";
    }

    return "Below threshold";
  }

  if (route.redirectedVehicles > 0) {
    return "Taking overflow";
  }

  return "Relief route";
}

function getSnapshotHeadline(
  snapshot: CorridorTickSnapshot,
  vehicles: Record<string, CorridorVehicleState>,
  threshold: number
) {
  if (snapshot.redirectedVehicleIds.length > 0) {
    return `${formatRedirectSummary(snapshot, vehicles)} after EDSA reached ${threshold}.`;
  }

  if (snapshot.activeRouteId === "edsa" && snapshot.reason === "preempted") {
    return "Emergency traffic stays on EDSA and interrupts lower-priority service.";
  }

  if (snapshot.queueLengthByRouteId.edsa >= threshold) {
    return "EDSA is at threshold; new arrivals will move to the lighter route.";
  }

  if (snapshot.activeVehicleId && snapshot.activeRouteId) {
    const activeVehicle = vehicles[snapshot.activeVehicleId];

    return `${activeVehicle.label} is using ${formatRouteLabel(
      snapshot.activeRouteId
    )}; EDSA has room for new arrivals.`;
  }

  return "The corridor is clear and waiting for arrivals.";
}

function getRecentEvents(
  timeline: CorridorTickSnapshot[],
  currentIndex: number,
  vehicles: Record<string, CorridorVehicleState>,
  threshold: number
) {
  return timeline
    .slice(0, currentIndex + 1)
    .filter(
      (snapshot) =>
        snapshot.redirectedVehicleIds.length > 0 ||
        snapshot.reason === "preempted" ||
        snapshot.queueLengthByRouteId.edsa >= threshold
    )
    .slice(-4)
    .map((snapshot) => ({
      tick: snapshot.tick,
      copy: getSnapshotHeadline(snapshot, vehicles, threshold)
    }));
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
  const activeVehicle = currentSnapshot.activeVehicleId
    ? simulationResult.vehicles[currentSnapshot.activeVehicleId]
    : null;
  const progressPercent =
    totalSteps <= 1 ? 100 : (currentIndex / (totalSteps - 1)) * 100;
  const maxPressure = Math.max(
    controls.loadThreshold + 2,
    ...routeCards.map((route) => route.queueIds.length + 1)
  );
  const thresholdPercent = (controls.loadThreshold / maxPressure) * 100;
  const currentHeadline = getSnapshotHeadline(
    currentSnapshot,
    simulationResult.vehicles,
    controls.loadThreshold
  );
  const recentEvents = getRecentEvents(
    simulationResult.timeline,
    currentIndex,
    simulationResult.vehicles,
    controls.loadThreshold
  );

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

      <section className="edsa-board" aria-label="EDSA overload demonstration">
        <div className="edsa-focus-header">
          <div>
            <p className="eyebrow">Load balancing demo</p>
            <h3>EDSA fills first. Overflow moves to lighter routes.</h3>
          </div>
          <p>
            Keep your eye on the threshold marker. Once EDSA reaches it, new
            rush-hour arrivals are redirected to C5 or Quirino.
          </p>
        </div>

        <div className="edsa-controls" aria-label="EDSA overload controls">
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
            <strong>{controls.rushHourBurst} arrivals</strong>
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

          <div className="edsa-control-summary">
            <span>Preemption</span>
            <strong>{preemptionEnabled ? "Emergency on" : "Off"}</strong>
          </div>
        </div>

        <section className="edsa-current-state" aria-label="Current overload state">
          <div>
            <span>Now</span>
            <strong>{currentHeadline}</strong>
          </div>
          <div>
            <span>Serving</span>
            <strong>{activeVehicle?.label ?? "None"}</strong>
          </div>
          <div>
            <span>Total queued</span>
            <strong>{countQueuedVehicles(currentSnapshot)}</strong>
          </div>
          <div>
            <span>Total redirected</span>
            <strong>{currentSnapshot.totalRedirectedVehicles}</strong>
          </div>
        </section>

        <section className="edsa-route-lanes" aria-label="Route queue pressure">
          {routeCards.map((route) => (
            <article
              className={`edsa-route-lane is-${route.id} ${
                route.currentActiveVehicle ? "is-active" : ""
              }`}
              key={route.id}
            >
              <div className="edsa-route-lane-header">
                <div>
                  <span>{route.name}</span>
                  <strong>
                    {currentSnapshot.queueLengthByRouteId[route.id]} waiting
                  </strong>
                </div>
                <p>{getRoutePressureStatus(route, controls.loadThreshold)}</p>
              </div>

              <div className="edsa-pressure-track" aria-hidden="true">
                <span
                  className="edsa-threshold-marker"
                  style={{ left: `${thresholdPercent}%` }}
                />
                <span
                  className="edsa-pressure-fill"
                  style={{
                    width: `${(route.queueIds.length / maxPressure) * 100}%`
                  }}
                />
              </div>

              <div
                className="corridor-queue-chips"
                aria-label={`${route.name} waiting vehicles`}
              >
                {route.queueIds.slice(0, 6).map((vehicleId) => {
                  const vehicle = simulationResult.vehicles[vehicleId];

                  return (
                    <span
                      className={`vehicle-chip is-${vehicle.priorityClass} ${
                        vehicle.wasRedirected ? "is-redirected" : ""
                      }`}
                      key={vehicleId}
                      title={`${vehicle.label}, ${formatPriority(
                        vehicle.priorityClass
                      )}`}
                    >
                      {getVehicleChipLabel(
                        currentSnapshot,
                        simulationResult.vehicles,
                        vehicleId
                      )}
                    </span>
                  );
                })}

                {route.queueIds.length > 6 ? (
                  <span className="vehicle-chip is-empty">
                    +{route.queueIds.length - 6} more
                  </span>
                ) : null}

                {route.queueIds.length === 0 ? (
                  <span className="vehicle-chip is-empty">Clear</span>
                ) : null}
              </div>

              <dl className="edsa-route-facts">
                <div>
                  <dt>Serving</dt>
                  <dd>{route.currentActiveVehicle?.label ?? "None"}</dd>
                </div>
                <div>
                  <dt>Avg wait</dt>
                  <dd>{formatWaitTime(route.averageWait)}t</dd>
                </div>
                <div>
                  <dt>Redirected in</dt>
                  <dd>{route.redirectedVehicles}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>

        <section className="edsa-event-rail" aria-label="Recent overload events">
          <div>
            <p className="eyebrow">Recent events</p>
            <h3>Only threshold and priority changes are shown.</h3>
          </div>

          <ol>
            {recentEvents.length === 0 ? (
              <li>
                <span>T{currentSnapshot.tick}</span>
                <p>{scenario.description}</p>
              </li>
            ) : (
              recentEvents.map((event) => (
                <li key={`${event.tick}-${event.copy}`}>
                  <span>T{event.tick}</span>
                  <p>{event.copy}</p>
                </li>
              ))
            )}
          </ol>
        </section>
      </section>
    </>
  );
}
