# Sakay OS

Sakay OS is a browser-based teaching tool for operating-system scheduling concepts using Philippine transit scenarios. It uses a Vite + React + TypeScript UI with pure TypeScript simulation modules so the scheduling logic can be tested separately from the interface.

## Current Status

- `Jeepney Bunching` is the main learning path and demonstrates Round Robin scheduling with aging.
- `EDSA Overload` is available as a corridor-priority simulation for load balancing and preemption concepts.
- `MRT Breakdown` is still a planned shell for future fault-tolerance and migration work.

The long-term scope and sequencing live in [ROADMAP.md](/Users/aamuros/School-Projects/Sakay-OS/ROADMAP.md).

## Getting Started

Requirements:
- Node.js 18+ recommended
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Run type checks:

```bash
npm run lint
```

Run tests:

```bash
npm run test
```

## Project Structure

- `src/components/` contains reusable React UI such as the scenario workspace.
- `src/scenarios/` contains scenario definitions, stage components, and static teaching content.
- `src/sim/` contains pure simulation logic and related tests.
- `src/styles/` contains global styling.
- `dist/` contains generated build output and should not be edited manually.

Additional simulator notes are in [src/sim/README.md](/Users/aamuros/School-Projects/Sakay-OS/src/sim/README.md).

## Scenarios

### Jeepney Bunching

Models the PRC-to-Buendia corridor and uses time-sliced dispatching to show queue rotation, wait pressure, and aging behavior.

Key ideas:
- Round Robin time quantum
- Aging to reduce starvation risk
- Tick-based playback and metrics snapshots

### EDSA Overload

Models traffic pressure across EDSA, C5, and Quirino to demonstrate:

- Priority classes
- Optional preemption
- Load-threshold rerouting

### MRT Breakdown

Currently a placeholder stage reserved for future breakdown, recovery, and passenger migration behavior.

## Development Notes

- Keep simulation logic in `src/sim/` framework-agnostic and deterministic.
- Add or update Vitest coverage for scheduler behavior before expanding UI behavior.
- Treat `ROADMAP.md` as the source of truth for project scope.
