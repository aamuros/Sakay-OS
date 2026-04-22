import { useEffect, useState } from "react";
import {
  jeepneyDemoConfig,
  jeepneyRouteLayout,
  jeepneyRoutePath,
  jeepneyTrafficSegments,
  makatiMapLabels,
  makatiRoads,
  type TrafficSegment
} from "./jeepneyDemo";
import type { ScenarioStageProps } from "./types";
import {
  buildJeepneyPlaybackFrames,
  type JeepneyPlaybackFrame,
  type JeepneyPlaybackState
} from "../sim/jeepneyPlayback";
import { runJeepneySimulation } from "../sim/jeepneyScheduler";
import type { JeepneySimulationConfig, MetricsSnapshot } from "../sim/types";

type LearningControls = {
  timeQuantum: number;
  agingThreshold: number;
  jeepneyCount: number;
  passengerArrivalRate: number;
};

type MarkerPosition = JeepneyPlaybackState & {
  left: string;
  top: string;
  stopName: string;
};

type ConceptCard = {
  title: string;
  tag: string;
  body: string;
};

type TrafficLevel = "light" | "moderate" | "heavy" | "severe";

type SegmentState = TrafficSegment & {
  level: TrafficLevel;
};

const routeStops = jeepneyDemoConfig.route.stops.map((stop) => {
  const layout = jeepneyRouteLayout.find(
    (routeStop) => routeStop.stopId === stop.id
  );

  if (!layout) {
    throw new Error(`Missing route layout for stop ${stop.id}.`);
  }

  return {
    ...stop,
    ...layout
  };
});

const defaultControls: LearningControls = {
  timeQuantum: jeepneyDemoConfig.timeQuantum,
  agingThreshold: jeepneyDemoConfig.agingThreshold ?? 5,
  jeepneyCount: jeepneyDemoConfig.jeepneys.length,
  passengerArrivalRate: jeepneyDemoConfig.passengerArrivalRate ?? 2
};

const markerOffsets = [
  { x: 0, y: -28 },
  { x: 24, y: 0 },
  { x: 0, y: 28 },
  { x: -24, y: 0 },
  { x: 18, y: -18 },
  { x: -18, y: 18 }
];
const routeWidth = 720;
const routeHeight = 360;
const tickDurationMs = 900;

function formatReason(reason: JeepneyPlaybackFrame["reason"]) {
  switch (reason) {
    case "dispatch":
      return "Fresh dispatch";
    case "continue-quantum":
      return "Quantum continues";
    case "quantum-expired":
      return "Quantum expired";
    case "aging-boost":
      return "Priority aging fired";
    default:
      return "Ready to dispatch";
  }
}

function compareJeepneys(
  first: JeepneyPlaybackState,
  second: JeepneyPlaybackState
) {
  if (first.isActive !== second.isActive) {
    return first.isActive ? -1 : 1;
  }

  if (first.queueIndex !== second.queueIndex) {
    if (first.queueIndex === null) {
      return 1;
    }

    if (second.queueIndex === null) {
      return -1;
    }

    return first.queueIndex - second.queueIndex;
  }

  return first.label.localeCompare(second.label);
}

function createInteractiveJeepneys(jeepneyCount: number) {
  const stopCount = jeepneyDemoConfig.route.stops.length;

  return Array.from({ length: jeepneyCount }, (_, index) => ({
    id: `j${index + 1}`,
    label: `J${index + 1}`,
    initialStopIndex: index % stopCount
  }));
}

function buildInteractiveConfig(
  controls: LearningControls
): JeepneySimulationConfig {
  return {
    route: jeepneyDemoConfig.route,
    jeepneys: createInteractiveJeepneys(controls.jeepneyCount),
    ticks: Math.max(18, controls.jeepneyCount * controls.timeQuantum * 2),
    timeQuantum: controls.timeQuantum,
    agingEnabled: true,
    agingThreshold: controls.agingThreshold,
    passengerArrivalRate: controls.passengerArrivalRate,
    passengerBoardingRate: jeepneyDemoConfig.passengerBoardingRate ?? 4
  };
}

function formatMetricValue(value: number) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(1);
}

function getJeepneyLabel(config: JeepneySimulationConfig, jeepneyId: string) {
  return (
    config.jeepneys.find((jeepney) => jeepney.id === jeepneyId)?.label ?? jeepneyId
  );
}

function getStopName(stopId: string | null) {
  if (!stopId) {
    return null;
  }

  return routeStops.find((stop) => stop.id === stopId)?.name ?? stopId;
}

function getStopBacklog(metric: MetricsSnapshot | null, stopId: string) {
  return metric?.stopPassengerQueues[stopId] ?? 0;
}

function bumpTrafficLevel(level: TrafficLevel): TrafficLevel {
  switch (level) {
    case "light":
      return "moderate";
    case "moderate":
      return "heavy";
    case "heavy":
      return "severe";
    default:
      return "severe";
  }
}

function getTrafficLevel(
  metric: MetricsSnapshot | null,
  segment: TrafficSegment
): TrafficLevel {
  const fromBacklog = getStopBacklog(metric, segment.fromStopId);
  const toBacklog = getStopBacklog(metric, segment.toStopId);
  const pressure = (fromBacklog + toBacklog) / 2;
  let level: TrafficLevel;

  if (pressure >= 4) {
    level = "severe";
  } else if (pressure >= 3) {
    level = "heavy";
  } else if (pressure >= 1.5) {
    level = "moderate";
  } else {
    level = "light";
  }

  if (
    metric?.busiestStopId &&
    [segment.fromStopId, segment.toStopId].includes(metric.busiestStopId)
  ) {
    return bumpTrafficLevel(level);
  }

  return level;
}

function buildSegmentStates(metric: MetricsSnapshot | null): SegmentState[] {
  return jeepneyTrafficSegments.map((segment) => ({
    ...segment,
    level: getTrafficLevel(metric, segment)
  }));
}

function getCorridorTrafficLevel(segmentStates: SegmentState[]): TrafficLevel {
  if (segmentStates.some((segment) => segment.level === "severe")) {
    return "severe";
  }

  if (segmentStates.some((segment) => segment.level === "heavy")) {
    return "heavy";
  }

  if (segmentStates.some((segment) => segment.level === "moderate")) {
    return "moderate";
  }

  return "light";
}

function formatTrafficLevel(level: TrafficLevel) {
  switch (level) {
    case "light":
      return "moving";
    case "moderate":
      return "building";
    case "heavy":
      return "slow";
    case "severe":
      return "jammed";
    default:
      return "moving";
  }
}

function buildMarkerPositions(frame: JeepneyPlaybackFrame): MarkerPosition[] {
  return frame.jeepneys.map((jeepney) => {
    const stop = routeStops[jeepney.stopIndex];
    const stopGroup = frame.jeepneys
      .filter((candidate) => candidate.stopIndex === jeepney.stopIndex)
      .sort(compareJeepneys);
    const markerIndex = stopGroup.findIndex(
      (candidate) => candidate.id === jeepney.id
    );
    const offset = markerOffsets[markerIndex] ?? { x: 0, y: 0 };

    return {
      ...jeepney,
      left: `${((stop.x + offset.x) / routeWidth) * 100}%`,
      top: `${((stop.y + offset.y) / routeHeight) * 100}%`,
      stopName: stop.name
    };
  });
}

function describeTimeQuantum(
  config: JeepneySimulationConfig,
  frame: JeepneyPlaybackFrame,
  activeLabel: string | null
) {
  if (!activeLabel) {
    return `Slice length set to ${config.timeQuantum} ticks. Start sim to see lane ownership.`;
  }

  if (frame.reason === "quantum-expired") {
    return `${activeLabel} used all ${config.timeQuantum} ticks, then moved to queue tail.`;
  }

  return `${activeLabel} using ${frame.quantumUsed}/${config.timeQuantum} ticks in current slice.`;
}

function describeContextSwitch(
  contextSwitches: number,
  previousLabel: string | null,
  activeLabel: string | null,
  didContextSwitch: boolean
) {
  if (!activeLabel) {
    return "Context switch card waits for first handoff.";
  }

  if (didContextSwitch && previousLabel) {
    return `${previousLabel} handed service lane to ${activeLabel}. Total switches: ${contextSwitches}.`;
  }

  return `${activeLabel} kept lane this tick. Total switches: ${contextSwitches}.`;
}

function describeStarvation(
  config: JeepneySimulationConfig,
  metric: MetricsSnapshot | null,
  currentFrame: JeepneyPlaybackFrame
) {
  if (!metric) {
    return `Starvation threshold armed at ${config.agingThreshold} wait ticks.`;
  }

  if (metric.atRiskJeepneyIds.length === 0) {
    return `No jeepney waiting at or past ${config.agingThreshold} ticks right now.`;
  }

  const riskList = metric.atRiskJeepneyIds
    .map((jeepneyId) => {
      const waitTicks = metric.waitByJeepneyId[jeepneyId] ?? 0;

      return `${jeepneyId.toUpperCase()} (${waitTicks}t)`;
    })
    .join(", ");

  if (currentFrame.reason === "aging-boost") {
    return `Risk visible now: ${riskList}. Scheduler promoted longest-waiting jeepney.`;
  }

  return `Risk visible now: ${riskList}. Aging ready if delay grows more.`;
}

function describePriorityAging(
  config: JeepneySimulationConfig,
  frame: JeepneyPlaybackFrame,
  activeLabel: string | null,
  activeWaitTicks: number
) {
  if (frame.reason === "aging-boost" && activeLabel) {
    return `${activeLabel} jumped queue after ${activeWaitTicks} wait ticks. Threshold: ${config.agingThreshold}.`;
  }

  return `Aging threshold set to ${config.agingThreshold} ticks. Longest waiter jumps queue once that mark is met.`;
}

function buildConceptCards(
  config: JeepneySimulationConfig,
  frame: JeepneyPlaybackFrame,
  metric: MetricsSnapshot | null,
  previousFrame: JeepneyPlaybackFrame | null,
  activeWaitTicks: number,
  didContextSwitch: boolean
): ConceptCard[] {
  const activeLabel = frame.activeJeepneyId
    ? getJeepneyLabel(config, frame.activeJeepneyId)
    : null;
  const previousLabel = previousFrame?.activeJeepneyId
    ? getJeepneyLabel(config, previousFrame.activeJeepneyId)
    : null;

  return [
    {
      title: "Time Quantum",
      tag: "CPU slice -> service lane",
      body: describeTimeQuantum(config, frame, activeLabel)
    },
    {
      title: "Context Switch",
      tag: "Handoff event",
      body: describeContextSwitch(
        metric?.contextSwitches ?? 0,
        previousLabel,
        activeLabel,
        didContextSwitch
      )
    },
    {
      title: "Starvation",
      tag: "Wait threshold watch",
      body: describeStarvation(config, metric, frame)
    },
    {
      title: "Priority Aging",
      tag: "Fairness correction",
      body: describePriorityAging(config, frame, activeLabel, activeWaitTicks)
    }
  ];
}

function getGanttCellClass(
  frame: JeepneyPlaybackFrame,
  metric: MetricsSnapshot,
  jeepneyId: string
) {
  if (frame.activeJeepneyId === jeepneyId) {
    return `gantt-cell is-active is-${frame.reason}`;
  }

  if (metric.atRiskJeepneyIds.includes(jeepneyId)) {
    return "gantt-cell is-risk";
  }

  if (frame.queue.includes(jeepneyId)) {
    return "gantt-cell is-waiting";
  }

  return "gantt-cell";
}

export function JeepneyStage({ scenario }: ScenarioStageProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [controls, setControls] = useState(defaultControls);

  const simulationConfig = buildInteractiveConfig(controls);
  const simulationResult = runJeepneySimulation(simulationConfig);
  const playbackFrames = buildJeepneyPlaybackFrames(
    simulationConfig,
    simulationResult
  );
  const safeFrameIndex =
    frameIndex < playbackFrames.length ? frameIndex : 0;
  const currentFrame = playbackFrames[safeFrameIndex];
  const currentMetric =
    currentFrame.tick >= 0 ? simulationResult.metrics[currentFrame.tick] : null;
  const previousFrame =
    safeFrameIndex > 0 ? playbackFrames[safeFrameIndex - 1] : null;
  const currentEvent =
    currentFrame.tick >= 0 ? simulationResult.events[currentFrame.tick] : null;
  const markerPositions = buildMarkerPositions(currentFrame);
  const activeJeepney = currentFrame.activeJeepneyId
    ? markerPositions.find(
        (jeepney) => jeepney.id === currentFrame.activeJeepneyId
      ) ?? null
    : null;
  const progressPercent =
    playbackFrames.length > 1
      ? (safeFrameIndex / (playbackFrames.length - 1)) * 100
      : 0;
  const totalTicks = Math.max(playbackFrames.length - 2, 0);
  const conceptCards = buildConceptCards(
    simulationConfig,
    currentFrame,
    currentMetric,
    previousFrame,
    currentEvent?.activeWaitTicks ?? 0,
    currentEvent?.didContextSwitch ?? false
  );
  const busiestStopName = getStopName(currentMetric?.busiestStopId ?? null);
  const segmentStates = buildSegmentStates(currentMetric);
  const corridorTrafficLevel = getCorridorTrafficLevel(segmentStates);

  useEffect(() => {
    if (!isRunning || safeFrameIndex >= playbackFrames.length - 1) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFrameIndex((current) => current + 1);
    }, tickDurationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isRunning, playbackFrames.length, safeFrameIndex]);

  useEffect(() => {
    if (frameIndex >= playbackFrames.length) {
      setFrameIndex(0);
      setIsRunning(false);
      return;
    }

    if (safeFrameIndex >= playbackFrames.length - 1) {
      setIsRunning(false);
    }
  }, [frameIndex, playbackFrames.length, safeFrameIndex]);

  useEffect(() => {
    setIsRunning(false);
    setFrameIndex(0);
  }, [
    controls.agingThreshold,
    controls.jeepneyCount,
    controls.passengerArrivalRate,
    controls.timeQuantum
  ]);

  return (
    <>
      <div className="control-bar" aria-label="Simulation controls">
        <div className="control-buttons">
          <button
            className="control-button primary"
            disabled={isRunning || safeFrameIndex >= playbackFrames.length - 1}
            onClick={() => {
              setIsRunning(true);
            }}
            type="button"
          >
            {safeFrameIndex === 0 ? "Start" : "Resume"}
          </button>
          <button
            className="control-button"
            disabled={!isRunning}
            onClick={() => {
              setIsRunning(false);
            }}
            type="button"
          >
            Pause
          </button>
          <button
            className="control-button"
            disabled={safeFrameIndex === 0 && !isRunning}
            onClick={() => {
              setIsRunning(false);
              setFrameIndex(0);
            }}
            type="button"
          >
            Reset
          </button>
        </div>

        <div className="timeline-readout">
          <div className="timeline-copy">
            <strong>
              Tick {Math.max(currentFrame.tick, 0)} / {totalTicks}
            </strong>
            <span>{formatReason(currentFrame.reason)}</span>
          </div>
          <div className="timeline-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <section className="learning-controls" aria-label="Learning controls">
        <div className="panel-section-header">
          <div>
            <p className="eyebrow">Phase 3 tuning</p>
            <h3>Live controls</h3>
          </div>
          <p>
            Each slider rebuilds the same Makati corridor with new scheduling
            rules.
          </p>
        </div>

        <div className="learning-control-grid">
          <label className="learning-control">
            <span>Time quantum</span>
            <strong>{controls.timeQuantum} ticks</strong>
            <input
              max={4}
              min={1}
              onChange={(event) => {
                const timeQuantum = Number(event.target.value);

                setControls((current) => ({
                  ...current,
                  timeQuantum,
                  agingThreshold: Math.max(current.agingThreshold, timeQuantum + 1)
                }));
              }}
              type="range"
              value={controls.timeQuantum}
            />
          </label>

          <label className="learning-control">
            <span>Aging threshold</span>
            <strong>{controls.agingThreshold} wait ticks</strong>
            <input
              max={10}
              min={2}
              onChange={(event) => {
                setControls((current) => ({
                  ...current,
                  agingThreshold: Number(event.target.value)
                }));
              }}
              type="range"
              value={controls.agingThreshold}
            />
          </label>

          <label className="learning-control">
            <span>Jeepney count</span>
            <strong>{controls.jeepneyCount} active units</strong>
            <input
              max={6}
              min={2}
              onChange={(event) => {
                setControls((current) => ({
                  ...current,
                  jeepneyCount: Number(event.target.value)
                }));
              }}
              type="range"
              value={controls.jeepneyCount}
            />
          </label>

          <label className="learning-control">
            <span>Passenger arrival rate</span>
            <strong>{controls.passengerArrivalRate} riders per stop</strong>
            <input
              max={5}
              min={0}
              onChange={(event) => {
                setControls((current) => ({
                  ...current,
                  passengerArrivalRate: Number(event.target.value)
                }));
              }}
              type="range"
              value={controls.passengerArrivalRate}
            />
          </label>
        </div>
      </section>

      <div className="live-grid">
        <div
          className="route-preview"
          aria-label="Google Maps inspired Makati jeepney corridor preview"
        >
          <div className="map-toolbar">
            <div className="map-search-shell" aria-hidden="true">
              <span className="map-search-pin is-origin" />
              <div className="map-search-copy">
                <strong>PRC Terminal</strong>
                <span>to Gil Puyat (Buendia)</span>
              </div>
            </div>

            <div className="map-status-cluster">
              <span className="map-mode-pill">PUJ</span>
              <span className={`traffic-pill is-${corridorTrafficLevel}`}>
                Traffic {formatTrafficLevel(corridorTrafficLevel)}
              </span>
            </div>
          </div>

          <div className="route-canvas">
            <div className="map-surface-tag">Makati corridor</div>

            <svg viewBox="0 0 720 360" role="img" aria-labelledby="route-title">
              <title id="route-title">
                Makati jeepney route from PRC terminal to Gil Puyat with active and waiting vehicles
              </title>
              {makatiRoads.map((road) => (
                <g key={road.id}>
                  <path className={`map-road-casing is-${road.tone}`} d={road.path} />
                  <path className={`map-road is-${road.tone}`} d={road.path} />
                  <text
                    className={`map-road-label is-${road.tone}`}
                    x={road.labelX}
                    y={road.labelY}
                  >
                    {road.name}
                  </text>
                </g>
              ))}

              {makatiMapLabels.map((label) => (
                <text
                  className={`map-area-label is-${label.kind}`}
                  key={label.id}
                  x={label.x}
                  y={label.y}
                >
                  {label.name}
                </text>
              ))}

              <path className="route-line-shadow" d={jeepneyRoutePath} />
              <path className="route-line" d={jeepneyRoutePath} />
              {segmentStates.map((segment) => (
                <g key={segment.id}>
                  <path className="traffic-segment-shadow" d={segment.path} />
                  <path className={`traffic-segment is-${segment.level}`} d={segment.path} />
                  <text
                    className={`traffic-label is-${segment.level}`}
                    x={segment.labelX}
                    y={segment.labelY}
                  >
                    {segment.label}
                  </text>
                </g>
              ))}

              {routeStops.map((stop) => (
                <g key={stop.id}>
                  <circle className="stop-ring" cx={stop.x} cy={stop.y} r="12" />
                  <circle className="stop-core" cx={stop.x} cy={stop.y} r="5" />
                  <text
                    className="stop-label"
                    x={stop.x + (stop.labelDx ?? 0)}
                    y={stop.y + (stop.labelDy ?? -22)}
                  >
                    {stop.name}
                  </text>
                </g>
              ))}
            </svg>

            <div className="stop-load-layer" aria-hidden="true">
              {routeStops.map((stop) => {
                const backlog =
                  currentMetric?.stopPassengerQueues[stop.id] ?? 0;

                return (
                  <div
                    className={`stop-load ${
                      currentMetric?.busiestStopId === stop.id ? "is-busiest" : ""
                    }`}
                    key={stop.id}
                    style={{
                      left: `${(stop.x / routeWidth) * 100}%`,
                      top: `${((stop.y + 30) / routeHeight) * 100}%`
                    }}
                  >
                    {backlog}
                  </div>
                );
              })}
            </div>

            <div className="jeepney-layer" aria-hidden="true">
              {markerPositions.map((jeepney) => (
                <div
                  className={`jeepney-marker ${
                    jeepney.isActive ? "is-active" : "is-waiting"
                  }`}
                  key={jeepney.id}
                  style={{
                    left: jeepney.left,
                    top: jeepney.top
                  }}
                >
                  <span>{jeepney.label}</span>
                </div>
              ))}
            </div>

            <div className="map-zoom-controls" aria-hidden="true">
              <span>+</span>
              <span>-</span>
              <span>◎</span>
            </div>

            <p className="map-attribution">
              Streets sketched from Makati corridor references and OpenStreetMap
              landmarks.
            </p>
          </div>

          <dl className="route-summary">
            <div>
              <dt>Passenger backlog</dt>
              <dd>{currentMetric?.passengerBacklog ?? 0}</dd>
            </div>
            <div>
              <dt>Served riders</dt>
              <dd>{currentMetric?.totalPassengersServed ?? 0}</dd>
            </div>
            <div>
              <dt>Pressure point</dt>
              <dd>{busiestStopName ?? "Balanced"}</dd>
            </div>
          </dl>
        </div>

        <aside className="queue-panel" aria-label="Queue state">
          <div className="queue-panel-header">
            <p className="eyebrow">Round Robin state</p>
            <h3>Makati dispatch queue</h3>
          </div>

          <div className="queue-active-card">
            <span>Running now</span>
            <strong>{activeJeepney?.label ?? "Standby"}</strong>
            <p>
              {activeJeepney
                ? `${activeJeepney.stopName}, ${currentEvent?.servedPassengers ?? 0} riders served this tick`
                : "Press start to dispatch the first jeepney into the corridor."}
            </p>
          </div>

          <div className="queue-list">
            {currentFrame.queue.map((jeepneyId, index) => {
              const jeepney = markerPositions.find(
                (candidate) => candidate.id === jeepneyId
              );

              if (!jeepney) {
                return null;
              }

              const waitTicks = currentMetric?.waitByJeepneyId[jeepneyId] ?? 0;
              const isAtRisk =
                currentMetric?.atRiskJeepneyIds.includes(jeepneyId) ?? false;

              return (
                <article
                  className={`queue-item ${isAtRisk ? "is-risk" : ""}`}
                  key={jeepney.id}
                >
                  <span>Q{index + 1}</span>
                  <div>
                    <strong>{jeepney.label}</strong>
                    <p>
                      Waiting at {jeepney.stopName} for {waitTicks} ticks
                      {isAtRisk ? " (starvation risk)" : ""}
                    </p>
                  </div>
                </article>
              );
            })}

            {currentFrame.queue.length === 0 ? (
              <p className="queue-empty">Queue empty. Active jeepney keeps lane.</p>
            ) : null}
          </div>

          <dl className="metric-list">
            <div>
              <dt>Throughput</dt>
              <dd>{currentMetric?.throughput ?? 0} stops</dd>
            </div>
            <div>
              <dt>Avg queued wait / jeepney</dt>
              <dd>{formatMetricValue(currentMetric?.averageWaitTime ?? 0)} ticks</dd>
            </div>
            <div>
              <dt>Context switches</dt>
              <dd>{currentMetric?.contextSwitches ?? 0}</dd>
            </div>
            <div>
              <dt>Starvation risk</dt>
              <dd>{currentMetric?.starvationRisk ?? 0} jeepneys</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="panel-grid">
        <section className="info-panel">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">OS mapping</p>
              <h3>Concept annotations</h3>
            </div>
            <p>Labels stay tied to current tick, not static glossary text.</p>
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
              <p className="eyebrow">Phase 3 focus</p>
              <h3>Learning notes</h3>
            </div>
            <p>
              More riders create pressure from PRC down through P. Ocampo,
              Yakal, and Buendia. Smaller slices add more switches. Lower aging
              threshold promotes fairness sooner.
            </p>
          </div>

          <div className="note-stack">
            <p>{scenario.description}</p>
            <p>
              Concrete load link: passenger arrival rate increases stop backlog,
              which raises wait pressure on jeepneys still queued at the busiest
              Makati choke points.
            </p>
          </div>
        </section>
      </div>

      <section className="gantt-panel" aria-label="Scheduling Gantt chart">
        <div className="panel-section-header">
          <div>
            <p className="eyebrow">Scheduling trace</p>
            <h3>Gantt chart</h3>
          </div>
          <p>Active slice, waiting queue, and starvation pressure across ticks.</p>
        </div>

        <div className="gantt-scroll">
          <div
            className="gantt-grid"
            style={{
              gridTemplateColumns: `120px repeat(${simulationResult.events.length}, minmax(42px, 1fr))`
            }}
          >
            <div className="gantt-label gantt-corner">Jeepney</div>
            {simulationResult.events.map((event) => (
              <div
                className={`gantt-tick ${
                  event.tick === currentFrame.tick ? "is-current" : ""
                }`}
                key={`tick-${event.tick}`}
              >
                T{event.tick}
              </div>
            ))}

            {simulationConfig.jeepneys.map((jeepney) => (
              <div className="gantt-row" key={jeepney.id}>
                <div className="gantt-label">{jeepney.label}</div>
                {simulationResult.events.map((event) => {
                  const metric = simulationResult.metrics[event.tick];
                  const isActive = event.activeJeepneyId === jeepney.id;

                  return (
                    <div
                      className={getGanttCellClass(
                        playbackFrames[event.tick + 1],
                        metric,
                        jeepney.id
                      )}
                      key={`${jeepney.id}-${event.tick}`}
                      title={
                        isActive
                          ? `${jeepney.label} running at ${getStopName(event.stopId)}`
                          : metric.atRiskJeepneyIds.includes(jeepney.id)
                            ? `${jeepney.label} near starvation`
                            : `${jeepney.label} waiting`
                      }
                    >
                      {isActive ? event.quantumUsed : metric.atRiskJeepneyIds.includes(jeepney.id) ? "!" : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="gantt-legend">
          <span className="legend-chip is-active">Active slice</span>
          <span className="legend-chip is-waiting">Ready queue</span>
          <span className="legend-chip is-risk">Starvation risk</span>
          <span className="legend-chip is-aging">Aging dispatch</span>
        </div>
      </section>
    </>
  );
}
