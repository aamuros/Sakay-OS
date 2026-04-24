# Sakay OS Roadmap

## Direction

Sakay OS should be presented as an operating-systems scheduling simulator first and a Philippine transit visualization second. The transit theme makes the project memorable, but the submitted version must clearly demonstrate OS concepts without relying on the evaluator to infer the analogy.

The core project should focus on one complete scenario: Jeepney Bunching as a CPU scheduling model. In this model, jeepneys act as processes, the dispatch lane acts as the CPU, the terminal line acts as the ready queue, and each dispatch decision is a scheduler event.

V0 should prove Round Robin scheduling, context switching, wait-time tracking, starvation risk, and aging. EDSA Overload and MRT Breakdown are stretch scenarios and should stay compact, deterministic, and clearly secondary to the Jeepney scheduler.

## OS Concept Mapping

The app should make this mapping visible in the UI and documentation:

- Jeepney = process/job.
- Dispatch lane = CPU/resource.
- Terminal line = ready queue.
- Dispatch decision = scheduler selection.
- Time slice = Round Robin quantum.
- Switching active jeepneys = context switch.
- Long terminal wait = starvation risk.
- Aging boost = starvation prevention.
- Completed passenger/service cycle = process progress.
- Throughput, average wait, turnaround, and context switches = scheduler metrics.

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
- Extra scenarios before the OS-facing Jeepney scheduler is polished.

## Phase 0: Scaffold

Goal: create a small, understandable app foundation.

- Initialize Vite React TypeScript structure.
- Add folders for simulation logic, scenarios, components, and styles.
- Create a working app shell with a scenario workspace.
- Show Jeepney Bunching as the active project path.
- Keep EDSA Overload and MRT Breakdown hidden, disabled, or clearly marked as stretch ideas.
- Keep state local and static until the simulation engine exists.

Exit criteria:

- App installs and builds.
- Shell renders without runtime errors.
- Roadmap and project scripts are present.
- The project description says this is an OS scheduling simulator, not only a transit simulator.

## Phase 1: Scheduling Core

Goal: model OS scheduling behavior without UI complexity.

- Define scheduler entities using OS-friendly names: process, ready queue, CPU slot, scheduling event, and metrics snapshot.
- Keep transit labels available as display metadata, such as `J1 / Process P1`.
- Implement deterministic simulation ticks.
- Implement Round Robin time quantum behavior.
- Track wait time, turnaround time, response time, throughput, context switches, and starvation risk.
- Add optional aging boost when a process waits beyond the threshold.
- Write Vitest coverage for scheduler behavior before connecting it to React.

Exit criteria:

- Tests prove fair rotation, quantum expiration, context switching, aging boost, and metric updates.
- Simulation can run from pure TypeScript input to event output.
- Scheduler output includes enough data to render a Gantt chart and process table.

## Phase 2: OS Scheduler UI

Goal: make the OS concepts visible before focusing on transit animation.

- Add a ready queue panel.
- Add a running process/CPU panel.
- Add a time quantum countdown.
- Add a process table showing process ID, jeepney label, state, wait time, turnaround time, remaining work, and aging status.
- Add a scheduler event log for dispatches, quantum expiration, context switches, and aging boosts.
- Use explicit OS labels beside the transit labels.

Exit criteria:

- A user can identify the ready queue, running process, time quantum, and context switches without reading external documentation.
- Each simulation tick updates the process table and event log consistently.
- The UI still uses Jeepney Bunching as the theme, but the main visible structure looks like an OS scheduler.

## Phase 3: Gantt Chart and Metrics

Goal: provide the standard OS project evidence.

- Add a Gantt chart for scheduling decisions over time.
- Mark context switches, quantum expirations, idle time, and aging dispatches.
- Add live metrics: throughput, average wait time, average turnaround time, response time, context switches, and starvation risk.
- Add controls for time quantum, aging threshold, process count, and workload size.
- Make metric changes visible when controls change.

Exit criteria:

- The Gantt chart matches the scheduler event output.
- Metrics update deterministically from the same simulation state used by the UI.
- The project can be demonstrated as a Round Robin plus Aging scheduler even if the transit animation is ignored.

## Phase 4: Algorithm Comparison

Goal: make the project feel like a complete OS scheduling study.

- Add a scheduler selector for FCFS, Round Robin, and Round Robin + Aging.
- Reuse the same process workload across algorithms for fair comparison.
- Show side-by-side or before-and-after metrics for each algorithm.
- Keep the comparison simple and deterministic.
- Add tests for each algorithm's ordering and metric behavior.

Exit criteria:

- Users can run the same workload under multiple algorithms.
- The UI clearly shows how time quantum and aging affect fairness, wait time, and starvation risk.
- Tests cover FCFS, Round Robin, and Round Robin + Aging behavior.

## Phase 5: Jeepney Visual Demo

Goal: add transit visualization as supporting explanation, not the main proof.

- Render a schematic jeepney route with stops using SVG.
- Animate jeepney positions from simulation ticks.
- Highlight the active process/jeepney and waiting jeepneys.
- Keep visuals schematic, not geographically accurate.
- Ensure visual movement reflects scheduler output rather than separate UI-only state.

Exit criteria:

- User can start, pause, step, and reset the Jeepney simulation.
- Movement reflects scheduler output.
- The visual demo reinforces the OS scheduler panels instead of replacing them.

## Phase 6: Submission Polish

Goal: prepare the project for grading and demonstration.

- Add a concise OS Mapping section to the README.
- Add a short demo script explaining the scheduler flow.
- Add screenshots or notes showing the ready queue, CPU panel, Gantt chart, process table, and metrics.
- Run `npm run lint`, `npm run test`, and `npm run build`.
- Keep the final demo focused on the Jeepney scheduler.

Exit criteria:

- README explains the OS concepts directly.
- Demo path is clear and repeatable.
- Tests and build pass.
- The project can be defended as an OS scheduling simulator in under five minutes.

## Stretch Scenarios

Only start these after the Jeepney scheduler is complete and polished.

### EDSA Overload

Goal: demonstrate priority scheduling and load balancing.

- Model multiple route queues: EDSA, C5, and Quirino.
- Add priority classes, including emergency vehicles.
- Add optional preemption.
- Redirect new vehicles when a route exceeds a load threshold.
- Track queue length, wait time, and redirected vehicles.

Exit criteria:

- Priority and preemption are visible in scheduling output.
- Load balancing changes route assignment under congestion.

### MRT Breakdown

Goal: demonstrate fault tolerance and process migration.

- Model a primary MRT route and backup transit routes.
- Add fault injection for station breakdowns.
- Migrate passengers to backup routes.
- Model degraded service and recovery.
- Track migration time, dropped passengers, and recovery status.
- Keep the implementation concise; it should teach fault tolerance rather than model full rail operations.

Exit criteria:

- Fault injection causes visible degradation.
- Backup migration keeps the system partially operating.
- Recovery returns the system to normal service.

## Working Rules

- Treat `ROADMAP.md` as the source of truth for scope.
- Build OS-facing scheduler evidence before adding visual polish.
- Keep each phase small enough to finish and verify independently.
- Do not expand EDSA or MRT until Jeepney Bunching is a complete OS scheduling demo.
- Prefer pure simulation logic over UI-first behavior.
- Add tests for scheduling rules before adding visuals.
- Use explicit OS names in code and UI where clarity matters.
- Revisit this roadmap after each phase and update scope if complexity grows.
