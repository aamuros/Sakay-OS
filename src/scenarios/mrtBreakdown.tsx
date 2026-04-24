import { useEffect, useState } from "react";
import { runMrtBreakdownSimulation } from "../sim/mrtBreakdownScheduler";
import type {
  MrtBackupRoute,
  MrtBreakdownSimulationConfig,
  MrtStation,
  MrtTickSnapshot
} from "../sim/mrtBreakdownTypes";
import type { ScenarioStageProps } from "./types";

type MrtControls = {
  failedStationId: string;
  recoveryTick: number;
};

const mrtStations: MrtStation[] = [
  { id: "north-avenue", name: "North Avenue" },
  { id: "quezon-avenue", name: "Quezon Avenue" },
  { id: "gma-kamuning", name: "GMA-Kamuning" },
  { id: "araneta-center-cubao", name: "Araneta Center-Cubao" },
  { id: "santolan-annapolis", name: "Santolan-Annapolis" },
  { id: "ortigas", name: "Ortigas" },
  { id: "shaw-boulevard", name: "Shaw Boulevard" },
  { id: "boni", name: "Boni" },
  { id: "guadalupe", name: "Guadalupe" },
  { id: "buendia", name: "Buendia" },
  { id: "ayala", name: "Ayala" },
  { id: "magallanes", name: "Magallanes" },
  { id: "taft-avenue", name: "Taft Avenue" }
];

const backupRoutes: MrtBackupRoute[] = [
  { id: "carousel", name: "EDSA Carousel", capacityPerTick: 3 },
  { id: "shuttle", name: "P2P Shuttle", capacityPerTick: 2 },
  { id: "feeder", name: "Jeepney Feeder", capacityPerTick: 1 }
];

const defaultControls: MrtControls = {
  failedStationId: "araneta-center-cubao",
  recoveryTick: 10
};

const tickDurationMs = 900;
const faultStartTick = 3;

function buildSimulationConfig(
  controls: MrtControls,
  faultEnabled: boolean
): MrtBreakdownSimulationConfig {
  return {
    stations: mrtStations,
    backupRoutes,
    ticks: 14,
    passengerArrivalRate: 2,
    primaryCapacityPerTick: 10,
    degradedCapacityPerTick: 5,
    dropThreshold: 5,
    fault: faultEnabled
      ? {
          stationId: controls.failedStationId,
          startTick: faultStartTick,
          recoveryTick: controls.recoveryTick
        }
      : null
  };
}

function formatEvent(
  snapshot: MrtTickSnapshot,
  stationName: string | null
) {
  switch (snapshot.event) {
    case "fault-injected":
      return `${stationName ?? "A station"} failed. Primary resource capacity dropped to ${snapshot.serviceLevelPercent}%.`;
    case "migration-active":
      return `${snapshot.migratedPassengers} passengers failed over to backup routes.`;
    case "passengers-dropped":
      return `${snapshot.droppedPassengers} passengers load-shed after backup routes filled.`;
    case "recovery-started":
      return "Recovery started. The primary resource is preparing to resume.";
    case "service-restored":
      return "Recovery complete. Primary MRT service is back to normal.";
    default:
      return "Primary MRT service is operating normally.";
  }
}

function formatStatus(status: MrtTickSnapshot["status"]) {
  switch (status) {
    case "degraded":
      return "Degraded";
    case "recovering":
      return "Recovering";
    case "recovered":
      return "Recovered";
    default:
      return "Normal";
  }
}

function getStationName(stationId: string | null) {
  if (!stationId) {
    return null;
  }

  return mrtStations.find((station) => station.id === stationId)?.name ?? stationId;
}

function getRecentEvents(timeline: MrtTickSnapshot[], currentIndex: number) {
  return timeline
    .slice(0, currentIndex + 1)
    .filter((snapshot) => snapshot.event !== "normal-service")
    .slice(-5);
}

function getBackupLoadLabel(snapshot: MrtTickSnapshot, route: MrtBackupRoute) {
  const load = snapshot.backupRouteLoads[route.id] ?? 0;

  if (load === 0) {
    return "Standby";
  }

  return `${load}/${route.capacityPerTick} moved`;
}

function getStationQueueLabel(snapshot: MrtTickSnapshot, station: MrtStation) {
  const queue = snapshot.stationQueues[station.id] ?? 0;

  return queue === 0 ? "Clear" : `${queue} waiting`;
}

export function MrtBreakdownStage(_props: ScenarioStageProps) {
  const [controls, setControls] = useState(defaultControls);
  const [currentStep, setCurrentStep] = useState(0);
  const [faultEnabled, setFaultEnabled] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const simulationConfig = buildSimulationConfig(controls, faultEnabled);
  const simulationResult = runMrtBreakdownSimulation(simulationConfig);
  const totalSteps = simulationResult.timeline.length;
  const currentIndex = Math.min(currentStep, Math.max(totalSteps - 1, 0));
  const currentSnapshot = simulationResult.timeline[currentIndex];
  const failedStationName = getStationName(currentSnapshot.failedStationId);
  const selectedStationName = getStationName(controls.failedStationId);
  const progressPercent =
    totalSteps <= 1 ? 100 : (currentIndex / (totalSteps - 1)) * 100;
  const recentEvents = getRecentEvents(simulationResult.timeline, currentIndex);
  const currentEventCopy = formatEvent(currentSnapshot, failedStationName);

  useEffect(() => {
    setCurrentStep(0);
    setHasStarted(false);
    setIsRunning(false);
  }, [controls.failedStationId, controls.recoveryTick, faultEnabled]);

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
            disabled={isRunning || currentIndex >= totalSteps - 1}
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
            className={`control-button ${faultEnabled ? "" : "primary"}`}
            onClick={() => {
              setFaultEnabled((current) => !current);
            }}
            type="button"
          >
            Inject breakdown
          </button>
        </div>

        <div className="timeline-readout">
          <div className="timeline-copy">
            <strong>
              Tick {currentSnapshot.tick} / {Math.max(totalSteps - 1, 0)}
            </strong>
            <span>{currentEventCopy}</span>
          </div>
          <div className="timeline-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <section className="mrt-board" aria-label="MRT breakdown demonstration">
        <div className="mrt-focus-header">
          <div>
            <p className="eyebrow">Fault tolerance and failover</p>
            <h3>MRT service degrades, fails over passengers, then recovers.</h3>
          </div>
          <p>
            The MRT line is the primary resource. A station failure reduces
            capacity, backup routes act as redundant workers, and overload is
            shed when every backup path is full.
          </p>
        </div>

        <div className="mrt-controls" aria-label="MRT breakdown controls">
          <label className="learning-control">
            <span>Failed station</span>
            <strong>{selectedStationName}</strong>
            <select
              onChange={(event) => {
                setControls((current) => ({
                  ...current,
                  failedStationId: event.target.value
                }));
              }}
              value={controls.failedStationId}
            >
              {mrtStations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </label>

          <label className="learning-control">
            <span>Recovery tick</span>
            <strong>T{controls.recoveryTick}</strong>
            <input
              max={12}
              min={6}
              onChange={(event) => {
                setControls((current) => ({
                  ...current,
                  recoveryTick: Number(event.target.value)
                }));
              }}
              type="range"
              value={controls.recoveryTick}
            />
          </label>

          <div className="mrt-control-summary">
            <span>Fault injection</span>
            <strong>{faultEnabled ? "Enabled" : "Disabled"}</strong>
          </div>
        </div>

        <section className="mrt-current-state" aria-label="Current MRT status">
          <div>
            <span>Now</span>
            <strong>{currentEventCopy}</strong>
          </div>
          <div>
            <span>Primary capacity</span>
            <strong>{currentSnapshot.serviceLevelPercent}%</strong>
          </div>
          <div>
            <span>Failed over</span>
            <strong>{currentSnapshot.totalMigratedPassengers}</strong>
          </div>
          <div>
            <span>Load shed</span>
            <strong>{currentSnapshot.totalDroppedPassengers}</strong>
          </div>
          <div>
            <span>Recovery</span>
            <strong>{formatStatus(currentSnapshot.status)}</strong>
          </div>
        </section>

        <section className="mrt-line-panel" aria-label="Primary MRT route">
          <div className="mrt-line-header">
            <div>
              <p className="eyebrow">Primary route</p>
              <h3>MRT-3 line</h3>
            </div>
            <p>{failedStationName ? `${failedStationName} is offline.` : "All stations online."}</p>
          </div>

          <div className="mrt-line-track" aria-hidden="true">
            {mrtStations.map((station) => {
              const isFailed = currentSnapshot.failedStationId === station.id;
              const queueLabel = getStationQueueLabel(currentSnapshot, station);

              return (
                <div
                  className={`mrt-station-node ${isFailed ? "is-failed" : ""}`}
                  key={station.id}
                >
                  <span />
                  <strong>{station.name}</strong>
                  <em>{queueLabel}</em>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mrt-backup-routes" aria-label="Backup transit routes">
          {backupRoutes.map((route) => {
            const load = currentSnapshot.backupRouteLoads[route.id] ?? 0;
            const loadPercent =
              route.capacityPerTick === 0
                ? 0
                : (load / route.capacityPerTick) * 100;

            return (
              <article className="mrt-backup-route" key={route.id}>
                <div>
                  <span>{route.name}</span>
                  <strong>{getBackupLoadLabel(currentSnapshot, route)}</strong>
                </div>
                <div className="mrt-backup-track" aria-hidden="true">
                  <span style={{ width: `${loadPercent}%` }} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="mrt-event-rail" aria-label="MRT breakdown events">
          <div>
            <p className="eyebrow">Event rail</p>
            <h3>Only fault, failover, load-shed, and recovery changes are shown.</h3>
          </div>

          <ol>
            {recentEvents.length === 0 ? (
              <li>
                <span>T{currentSnapshot.tick}</span>
                <p>Normal service. No fault has been injected yet.</p>
              </li>
            ) : (
              recentEvents.map((snapshot) => (
                <li key={`${snapshot.tick}-${snapshot.event}`}>
                  <span>T{snapshot.tick}</span>
                  <p>{formatEvent(snapshot, getStationName(snapshot.failedStationId))}</p>
                </li>
              ))
            )}
          </ol>
        </section>
      </section>
    </>
  );
}
