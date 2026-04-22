# Sakay OS Roadmap

## Direction

Sakay OS is a browser-based teaching tool for operating-system scheduling concepts using Philippine transit simulations. The first version should prove one scenario end-to-end before expanding.

The original concept is strong, but too broad for initial scaffolding. Three simulations, animated route maps, Gantt charts, live metrics, concept overlays, and tunable controls would create too many moving parts at once. V0 should focus on one complete scenario: Jeepney Bunching with Round Robin and Aging.

## Tech Stack

- Vite + React + TypeScript for the app shell and interactive UI.
- Plain CSS for early styling; no UI framework until repeated components justify it.
- SVG for schematic transit visuals; avoid canvas until animation complexity demands it.
- Pure TypeScript modules for scheduling logic so simulations can be tested without React.
- Vitest for scheduler and metric tests.
- Playwright later for browser-level checks after the UI stabilizes.

Avoid in early phases:

- Backend services.
- Database storage.
- Next.js routing.
- Heavy mapping libraries.
- Game engines.

## Phase 0: Scaffold

Goal: create a small, understandable app foundation.

- Initialize Vite React TypeScript structure.
- Add folders for simulation logic, scenarios, components, and styles.
- Create a working app shell with a scenario workspace.
- Show the three planned scenarios, but mark Jeepney Bunching as the only active v0 path.
- Keep state local and static until the simulation engine exists.

Exit criteria:

- App installs and builds.
- Shell renders without runtime errors.
- Roadmap and project scripts are present.

## Phase 1: Jeepney Scheduling Core

Goal: model Round Robin plus Aging without UI complexity.

- Define simulation entities: jeepney, stop, route, scheduling event, metrics snapshot.
- Implement deterministic simulation ticks.
- Implement Round Robin time quantum behavior.
- Track wait time, throughput, context switches, and starvation risk.
- Add optional aging boost when a jeepney waits beyond the threshold.
- Write Vitest coverage for scheduler behavior before connecting it to React.

Exit criteria:

- Tests prove fair rotation, quantum expiration, aging boost, and metric updates.
- Simulation can run from pure TypeScript input to event output.

## Phase 2: Jeepney Visual Demo

Goal: make the scheduling behavior visible.

- Render a schematic jeepney route with stops using SVG.
- Animate jeepney positions from simulation ticks.
- Highlight the active jeepney and waiting jeepneys.
- Display queue state beside the route.
- Keep visuals schematic, not geographically accurate.

Exit criteria:

- User can start, pause, and reset the Jeepney simulation.
- Movement reflects scheduler output.

## Phase 3: Learning UI

Goal: connect transit behavior to OS concepts.

- Add a Gantt chart for scheduling decisions.
- Add live metrics: throughput, average wait, starvation risk, context switches.
- Add controls for time quantum, aging threshold, jeepney count, and passenger arrival rate.
- Add concept annotations for time quantum, context switch, starvation, and priority aging.

Exit criteria:

- Changing controls visibly changes simulation behavior.
- OS concept labels map to concrete simulation events.

## Phase 4: Scenario Framework

Goal: prepare for more scenarios only after Jeepney works.

- Extract a shared scenario interface.
- Add a scenario switcher.
- Move Jeepney-specific code behind the interface.
- Add non-interactive shells for EDSA Overload and MRT Breakdown.

Exit criteria:

- New scenarios can plug into the same workspace structure.
- Existing Jeepney behavior does not regress.

## Phase 5: EDSA Overload

Goal: demonstrate priority scheduling and load balancing.

- Model multiple route queues: EDSA, C5, and Quirino.
- Add priority classes, including emergency vehicles.
- Add optional preemption.
- Redirect new vehicles when a route exceeds a load threshold.
- Track queue length, wait time, and redirected vehicles.

Exit criteria:

- Priority and preemption are visible in scheduling output.
- Load balancing changes route assignment under congestion.

## Phase 6: MRT Breakdown

Goal: demonstrate fault tolerance and process migration.

- Model a primary MRT route and backup transit routes.
- Add fault injection for station breakdowns.
- Migrate passengers to backup routes.
- Model degraded service and recovery.
- Track migration time, dropped passengers, and recovery status.

Exit criteria:

- Fault injection causes visible degradation.
- Backup migration keeps the system partially operating.
- Recovery returns the system to normal service.

## Working Rules

- Keep each phase small enough to finish and verify independently.
- Do not start EDSA or MRT implementation until Jeepney Bunching is playable.
- Prefer pure simulation logic over UI-first behavior.
- Add tests for scheduling rules before adding visuals.
- Revisit this roadmap after each phase and update scope if complexity grows.
