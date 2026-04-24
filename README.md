# Sakay OS

Sakay OS is a classroom web app that explains operating system scheduling through familiar public transport examples in the Philippines.

Instead of showing abstract processes only, the project uses jeepneys, roads, and train routes to make scheduling easier to understand.

## What This Project Tries To Teach

The app connects OS ideas to transport situations:

- Vehicle = process
- Dispatcher or active lane = CPU
- Waiting line = ready queue
- Taking turns = scheduling
- Time slice = quantum
- Long waiting time = starvation risk
- Aging = a way to prevent starvation

The main demo is `Jeepney Bunching`, which focuses on `Round Robin + Aging`.

## What You Can Show To Classmates

### 1. Jeepney Bunching

This is the main scenario of the project.

It shows how jeepneys take turns using a fixed time slice. If one jeepney waits too long, aging helps it move forward so it will not be ignored for too long.

Main ideas:
- Round Robin scheduling
- Time quantum
- Context switching
- Starvation prevention through aging

### 2. EDSA Overload

This scenario shows how traffic can be distributed when one route becomes too busy.

Main ideas:
- Priority scheduling
- Preemption
- Load balancing

### 3. MRT Breakdown

This scenario shows what happens when one part of the system fails and passengers need to be moved to backup routes.

Main ideas:
- Fault tolerance
- Recovery
- Process migration

## How To Run The Project

Requirements:
- Node.js 18+
- npm

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open the local Vite link shown in the terminal.

## How To Use The App

1. Choose a scenario at the top of the page.
2. Press `Start` to begin the simulation.
3. Watch which vehicle or route becomes active at each tick.
4. Read the queue, status, and metric changes while the simulation runs.
5. Change the controls to see how the scheduling behavior changes.

## Simple Project Flow

- `src/scenarios/` contains the lessons shown in the interface.
- `src/sim/` contains the actual simulation logic.
- `src/components/` contains reusable UI parts.
- `src/styles/` contains the app styling.

If someone only wants to understand the project quickly, this README is enough.

For implementation details:
- Simulator notes: [src/sim/README.md](/Users/aamuros/School-Projects/Sakay-OS/src/sim/README.md)
- Development plan: [ROADMAP.md](/Users/aamuros/School-Projects/Sakay-OS/ROADMAP.md)

## Useful Commands

```bash
npm run build
```

Creates a production build.

```bash
npm run lint
```

Runs TypeScript checks.

```bash
npm run test
```

Runs the automated tests.
