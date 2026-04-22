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
  mapX: number;
  mapY: number;
  stopName: string;
};

type TrafficLevel = "light" | "moderate" | "heavy" | "severe";

type SegmentState = TrafficSegment & {
  level: TrafficLevel;
};

type QueueEntry = {
  jeepney: MarkerPosition;
  waitTicks: number;
  isAtRisk: boolean;
};

const routeStops = jeepneyDemoConfig.route.stops;
const visibleRoadLabelIds = new Set(["chino-roces", "gil-puyat"]);
const routeLayoutByStopId = new Map(
  jeepneyRouteLayout.map((layout) => [layout.stopId, layout])
);

const defaultControls: LearningControls = {
  timeQuantum: jeepneyDemoConfig.timeQuantum,
  agingThreshold: jeepneyDemoConfig.agingThreshold ?? 5,
  jeepneyCount: jeepneyDemoConfig.jeepneys.length,
  passengerArrivalRate: jeepneyDemoConfig.passengerArrivalRate ?? 2
};

const tickDurationMs = 900;

function formatReason(reason: JeepneyPlaybackFrame["reason"]) {
  switch (reason) {
    case "dispatch":
      return "New time slice";
    case "continue-quantum":
      return "Time slice continues";
    case "quantum-expired":
      return "Time slice ended";
    case "aging-boost":
      return "Aging prevented starvation";
    default:
      return "Waiting for first dispatch";
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

function formatQueuePreview(labels: string[]) {
  if (labels.length === 0) {
    return "No jeepneys are waiting for the next turn.";
  }

  if (labels.length <= 3) {
    return labels.join(" -> ");
  }

  return `${labels.slice(0, 3).join(" -> ")} +${labels.length - 3} more`;
}

function buildVisibleStopBadgeIds(
  metric: MetricsSnapshot | null,
  activeStopId: string | null
) {
  const visibleStopIds = new Set<string>();

  if (!metric) {
    return visibleStopIds;
  }

  if (metric.busiestStopId && getStopBacklog(metric, metric.busiestStopId) > 0) {
    visibleStopIds.add(metric.busiestStopId);
  }

  if (activeStopId && getStopBacklog(metric, activeStopId) > 0) {
    visibleStopIds.add(activeStopId);
  }

  return visibleStopIds;
}

function buildMarkerPositions(frame: JeepneyPlaybackFrame): MarkerPosition[] {
  return frame.jeepneys.map((jeepney) => {
    const stop = routeStops[jeepney.stopIndex];
    const stopLayout = routeLayoutByStopId.get(stop.id);
    const stopGroup = frame.jeepneys
      .filter((candidate) => candidate.stopIndex === jeepney.stopIndex)
      .sort(compareJeepneys);
    const markerIndex = stopGroup.findIndex(
      (candidate) => candidate.id === jeepney.id
    );
    const row = Math.floor(markerIndex / 2);
    const sideOffset = markerIndex % 2 === 0 ? 22 : -22;

    return {
      ...jeepney,
      mapX: (stopLayout?.x ?? 0) + sideOffset,
      mapY: (stopLayout?.y ?? 0) - (26 + row * 18),
      stopName: stop.name
    };
  });
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

export function JeepneyStage(_props: ScenarioStageProps) {
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
  const currentEvent =
    currentFrame.tick >= 0 ? simulationResult.events[currentFrame.tick] : null;
  const markerPositions = buildMarkerPositions(currentFrame);
  const activeJeepney = currentFrame.activeJeepneyId
    ? markerPositions.find(
        (jeepney) => jeepney.id === currentFrame.activeJeepneyId
      ) ?? null
    : null;
  const activeStopId =
    currentEvent?.stopId ??
    (activeJeepney ? routeStops[activeJeepney.stopIndex]?.id ?? null : null);
  const progressPercent =
    playbackFrames.length > 1
      ? (safeFrameIndex / (playbackFrames.length - 1)) * 100
      : 0;
  const totalTicks = Math.max(playbackFrames.length - 2, 0);
  const busiestStopName = getStopName(currentMetric?.busiestStopId ?? null);
  const busiestStopBacklog = currentMetric?.busiestStopId
    ? getStopBacklog(currentMetric, currentMetric.busiestStopId)
    : 0;
  const segmentStates = buildSegmentStates(currentMetric);
  const corridorTrafficLevel = getCorridorTrafficLevel(segmentStates);
  const visibleStopBadgeIds = buildVisibleStopBadgeIds(currentMetric, activeStopId);
  const waitingJeepneyCount = currentFrame.queue.length;
  const queueEntries: QueueEntry[] = currentFrame.queue
    .map((jeepneyId) => {
      const jeepney = markerPositions.find((candidate) => candidate.id === jeepneyId);

      if (!jeepney) {
        return null;
      }

      return {
        jeepney,
        waitTicks: currentMetric?.waitByJeepneyId[jeepneyId] ?? 0,
        isAtRisk: currentMetric?.atRiskJeepneyIds.includes(jeepneyId) ?? false
      };
    })
    .filter((entry): entry is QueueEntry => entry !== null);
  const queuePreview = queueEntries.map((entry) => entry.jeepney.label);
  const firstAtRiskEntry = queueEntries.find((entry) => entry.isAtRisk) ?? null;
  const agingTriggered = currentFrame.reason === "aging-boost" && activeJeepney !== null;
  const activeStatusCopy = activeJeepney
    ? `${activeJeepney.label} at ${activeJeepney.stopName}. ${currentEvent?.servedPassengers ?? 0} boarded this tick.`
    : "Press Start to begin the corridor run.";
  const starvationValue = agingTriggered
    ? `Aging dispatched ${activeJeepney?.label ?? "a jeepney"}`
    : (currentMetric?.starvationRisk ?? 0) > 0
      ? `${currentMetric?.starvationRisk ?? 0} unit${(currentMetric?.starvationRisk ?? 0) === 1 ? "" : "s"} near limit`
      : "No aging needed";
  const starvationDetail = agingTriggered
    ? `${activeJeepney?.label ?? "A jeepney"} moved forward after waiting ${currentEvent?.activeWaitTicks ?? 0} ticks.`
    : firstAtRiskEntry
      ? `${firstAtRiskEntry.jeepney.label} has waited ${firstAtRiskEntry.waitTicks}/${simulationConfig.agingThreshold} ticks.`
      : `Aging steps in after ${simulationConfig.agingThreshold} wait ticks.`;
  const lessonMetrics = [
    {
      label: "Active time slice",
      value: activeJeepney
        ? `${activeJeepney.label} ${currentEvent?.quantumUsed ?? 0}/${simulationConfig.timeQuantum}`
        : "Ready to start",
      detail: activeJeepney
        ? `${activeJeepney.stopName} is using the lane now.`
        : "Press Start to begin the first time slice."
    },
    {
      label: "Ready queue",
      value: waitingJeepneyCount === 0 ? "Clear" : `${waitingJeepneyCount} waiting`,
      detail:
        waitingJeepneyCount === 0
          ? "No jeepneys are waiting for the next turn."
          : formatQueuePreview(queuePreview)
    },
    {
      label: "Starvation prevention",
      value: starvationValue,
      detail: starvationDetail
    },
    {
      label: "Passenger pressure",
      value: busiestStopName ?? "Balanced",
      detail: busiestStopName
        ? `${busiestStopBacklog} riders are waiting at the busiest stop.`
        : `Traffic is ${formatTrafficLevel(corridorTrafficLevel)} across the corridor.`
    }
  ];
  const queueMetricItems = [
    {
      label: "Avg wait",
      value: `${formatMetricValue(currentMetric?.averageWaitTime ?? 0)} ticks`
    },
    {
      label: "Switches",
      value: `${currentMetric?.contextSwitches ?? 0}`
    },
    {
      label: "Aging watch",
      value: `${currentMetric?.starvationRisk ?? 0} unit${(currentMetric?.starvationRisk ?? 0) === 1 ? "" : "s"}`
    }
  ];
  const queueCardCopy = activeJeepney
    ? `${activeJeepney.stopName} · ${currentEvent?.quantumUsed ?? 0}/${simulationConfig.timeQuantum} · ${currentEvent?.servedPassengers ?? 0} boarded`
    : "Press Start to begin the rotation.";
  const starvationPanelCopy = agingTriggered
    ? `${activeJeepney?.label ?? "A jeepney"} skipped ahead after waiting ${currentEvent?.activeWaitTicks ?? 0} ticks.`
    : firstAtRiskEntry
      ? `${firstAtRiskEntry.jeepney.label} is nearing the ${simulationConfig.agingThreshold}-tick aging limit.`
      : `No jeepney is near the aging limit. Trigger at ${simulationConfig.agingThreshold} ticks.`;

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

      <div className="jeepney-dashboard">
        <section className="info-panel lesson-summary" aria-label="Concept overview">
          <div className="lesson-summary-copy">
            <p className="eyebrow">Concept overview</p>
            <h3>Time-Sliced Scheduling with Starvation Prevention</h3>
            <p>
              Each jeepney gets a short turn on the corridor. The ready queue
              shows who runs next, and aging promotes a long-waiting jeepney
              before it starves.
            </p>
          </div>

          <div className="lesson-metrics">
            {lessonMetrics.map((item) => (
              <article className="lesson-metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="live-grid">
          <section className="route-preview" aria-label="Makati jeepney corridor preview">
            <div className="route-preview-shell">
              <div className="route-preview-header">
                <div>
                  <p className="eyebrow">Corridor map</p>
                  <h3>PRC to Buendia</h3>
                </div>
                <div className="route-preview-meta">
                  <p>{activeStatusCopy}</p>
                </div>
              </div>

              <div className="route-canvas route-canvas-map">
                <span className={`traffic-pill is-${corridorTrafficLevel}`}>
                  Traffic {formatTrafficLevel(corridorTrafficLevel)}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 760 360"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {makatiRoads.map((road) => (
                    <g key={road.id}>
                      <path className={`map-road-casing is-${road.tone}`} d={road.path} />
                      <path className={`map-road is-${road.tone}`} d={road.path} />
                      {visibleRoadLabelIds.has(road.id) ? (
                        <text
                          className={`map-road-label is-${road.tone}`}
                          x={road.labelX}
                          y={road.labelY}
                        >
                          {road.name}
                        </text>
                      ) : null}
                    </g>
                  ))}

                  {makatiMapLabels
                    .filter((label) => label.kind === "district")
                    .map((label) => (
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
                      <path
                        className={`traffic-segment is-${segment.level}`}
                        d={segment.path}
                      />
                    </g>
                  ))}

                  {jeepneyRouteLayout.map((stopLayout) => {
                    const stop = routeStops.find(
                      (candidate) => candidate.id === stopLayout.stopId
                    );
                    const backlog = getStopBacklog(currentMetric, stopLayout.stopId);
                    const isBusiest = currentMetric?.busiestStopId === stopLayout.stopId;
                    const showBadge = visibleStopBadgeIds.has(stopLayout.stopId);
                    const badgeWidth = backlog >= 10 ? 72 : 64;
                    const badgeX = stopLayout.x - badgeWidth / 2;
                    const badgeY = stopLayout.y + 16;

                    return (
                      <g key={stopLayout.stopId}>
                        <circle
                          className={`stop-ring ${isBusiest ? "is-busiest" : ""}`}
                          cx={stopLayout.x}
                          cy={stopLayout.y}
                          r="10"
                        />
                        <circle
                          className={`stop-core ${isBusiest ? "is-busiest" : ""}`}
                          cx={stopLayout.x}
                          cy={stopLayout.y}
                          r="4.5"
                        />
                        <text
                          className="stop-label"
                          x={stopLayout.x + (stopLayout.labelDx ?? 0)}
                          y={stopLayout.y + (stopLayout.labelDy ?? -22)}
                        >
                          {stop?.name ?? stopLayout.stopId}
                        </text>
                        {showBadge ? (
                          <g
                            className={`stop-load-badge ${isBusiest ? "is-busiest" : ""}`}
                            transform={`translate(${badgeX} ${badgeY})`}
                          >
                            <rect height="24" rx="12" width={badgeWidth} />
                            <text x={badgeWidth / 2} y="16">
                              {backlog} riders
                            </text>
                          </g>
                        ) : null}
                      </g>
                    );
                  })}

                  {markerPositions.map((jeepney) => (
                    <g
                      className={`map-jeepney-token ${
                        jeepney.isActive ? "is-active" : "is-waiting"
                      }`}
                      key={jeepney.id}
                      transform={`translate(${jeepney.mapX} ${jeepney.mapY})`}
                    >
                      <rect height="28" rx="14" width="38" x="-19" y="-14" />
                      <text x="0" y="4">
                        {jeepney.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="route-legend" aria-label="Map legend">
                <span className="route-legend-chip is-active">Active</span>
                <span className="route-legend-chip is-waiting">Queued</span>
                <span className="route-legend-chip is-backlog">Backlog</span>
              </div>
            </div>
          </section>

          <aside className="queue-panel" aria-label="Ready queue and starvation prevention">
            <div className="queue-panel-header">
              <p className="eyebrow">Ready queue</p>
              <h3>Dispatch order</h3>
              <p>
                Front of the queue gets the next turn. Aging promotes long-waiting
                units.
              </p>
            </div>

            <div className="queue-active-card">
              <span>Current slice</span>
              <div className="queue-active-card-body">
                <strong>{activeJeepney?.label ?? "Standby"}</strong>
                <p>{queueCardCopy}</p>
              </div>
            </div>

            <div
              className={`queue-aging-note ${
                agingTriggered ? "is-triggered" : firstAtRiskEntry ? "is-warning" : ""
              }`}
            >
              <strong>Aging watch</strong>
              <p>{starvationPanelCopy}</p>
            </div>

            <div className="queue-list">
              {queueEntries.map((entry, index) => (
                <article
                  className={`queue-item ${entry.isAtRisk ? "is-risk" : ""}`}
                  key={entry.jeepney.id}
                >
                  <div
                    aria-label={`Queue position ${index + 1}`}
                    className="queue-item-order"
                  >
                    <strong>{index + 1}</strong>
                  </div>
                  <div className="queue-item-main">
                    <strong>{entry.jeepney.label}</strong>
                    <p>{entry.jeepney.stopName}</p>
                  </div>
                  <div className={`queue-item-state ${entry.isAtRisk ? "is-risk" : ""}`}>
                    <strong>{entry.waitTicks}t</strong>
                    {entry.isAtRisk ? <p>aging soon</p> : null}
                  </div>
                </article>
              ))}

              {queueEntries.length === 0 ? (
                <p className="queue-empty">
                  Ready queue clear. The current jeepney keeps the lane until its
                  time slice ends.
                </p>
              ) : null}
            </div>

            <dl className="metric-list queue-metric-list">
              {queueMetricItems.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <section className="info-panel trace-panel" aria-label="Scheduling Gantt chart">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">Tick history</p>
              <h3>Scheduling trace</h3>
            </div>
            <p>
              Each column is one tick. Numbers mark the active time slice step,
              and <strong>!</strong> marks a jeepney that is close to starvation.
            </p>
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
            <span className="legend-chip is-active">Active time slice</span>
            <span className="legend-chip is-waiting">Waiting in ready queue</span>
            <span className="legend-chip is-risk">Near starvation</span>
            <span className="legend-chip is-aging">Aging dispatch</span>
          </div>
        </section>

        <section className="info-panel control-panel" aria-label="Learning controls">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">Experiment</p>
              <h3>Adjust the scheduler</h3>
            </div>
            <p>
              Change one input at a time so the effect on fairness and bunching
              stays easy to read.
            </p>
          </div>

          <div className="learning-control-grid">
            <label className="learning-control">
              <span>Time quantum</span>
              <strong>{controls.timeQuantum} ticks</strong>
              <p>Shorter slices rotate the lane more often.</p>
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
              <p>Lower values rescue long-waiting jeepneys sooner.</p>
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
              <p>More jeepneys deepen the ready queue.</p>
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
              <p>Higher demand builds pressure and bunching at the stops.</p>
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
      </div>
    </>
  );
}
