# Sakay OS

Sakay OS is a web-based operating systems scheduling simulator that uses public transportation scenarios in the Philippines to explain core scheduling concepts in a more familiar way. The project presents scheduler behavior through interactive visual simulations and deterministic logic written in TypeScript.

## Project Overview

The main goal of Sakay OS is to help students understand how scheduling algorithms work by connecting operating system concepts to transport flow:

- `Jeepney` represents a `process`
- `Dispatch lane` represents the `CPU`
- `Terminal queue` represents the `ready queue`
- `Dispatch turn` represents a `scheduler decision`
- `Time slice` represents the `quantum`
- `Long waiting time` represents `starvation risk`
- `Aging` represents `starvation prevention`

The application is designed as an instructional simulator first. The transport theme supports the explanation, but the project remains centered on operating systems concepts.

## Objectives

This project aims to:

- demonstrate how scheduling decisions are made over time
- show the effect of time slicing, waiting, and fairness
- explain starvation and aging using a simple visual model
- provide a small interactive environment for comparing scheduling behavior

## Implemented Scenarios

### 1. Jeepney Bunching

This is the primary scenario of the project.

- Focus: `Round Robin + Aging`
- Demonstrates fixed time slices, queue rotation, context switching, and starvation prevention

### 2. EDSA Overload

This scenario extends the simulation to overloaded corridors.

- Focus: `Priority + Load Balancing`
- Demonstrates priority scheduling, rerouting, and congestion management

### 3. MRT Breakdown

This scenario models service interruption and recovery.

- Focus: `Fault Tolerant Scheduling`
- Demonstrates failure handling, migration to backup routes, and recovery behavior

## Main Features

- interactive scenario selection
- deterministic simulation behavior
- scheduling logic separated from the React UI
- automated tests for simulation modules
- support for multiple scheduling-related transport cases

## Technology Stack

- `Vite`
- `React`
- `TypeScript`
- `Vitest`
- `CSS`

## Project Structure

```text
src/
  components/   React UI components
  scenarios/    Scenario definitions and stage views
  sim/          Pure simulation logic and tests
  styles/       Global styling
```

- [src/components](/Users/aamuros/School-Projects/Sakay-OS/src/components) contains the main interface pieces
- [src/scenarios](/Users/aamuros/School-Projects/Sakay-OS/src/scenarios) contains the scenario content and configuration
- [src/sim](/Users/aamuros/School-Projects/Sakay-OS/src/sim) contains the scheduler logic, playback utilities, and tests
- [src/styles](/Users/aamuros/School-Projects/Sakay-OS/src/styles) contains global CSS

## Installation and Setup

### Requirements

- `Node.js 18` or higher
- `npm`

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

After starting the server, open the local Vite URL shown in the terminal.

## Available Commands

```bash
npm run dev
```

Starts the local development server.

```bash
npm run build
```

Builds the project for production.

```bash
npm run lint
```

Runs TypeScript checks for the application and Vite configuration.

```bash
npm run test
```

Runs the automated test suite using Vitest.

## How to Use the Application

1. Open the application in the browser.
2. Select a scenario from the scenario tabs.
3. Start or interact with the simulation controls.
4. Observe how the active route or vehicle changes over time.
5. Use the displayed behavior to relate the scenario to operating systems scheduling concepts.

## Development Notes

The simulation logic is intentionally separated from the user interface so that the scheduler behavior can be tested independently. This keeps the project easier to verify, explain, and extend.

For implementation details and future scope:

- [ROADMAP.md](/Users/aamuros/School-Projects/Sakay-OS/ROADMAP.md)
- [src/sim/README.md](/Users/aamuros/School-Projects/Sakay-OS/src/sim/README.md)

## Submission Summary

Sakay OS is a classroom scheduling simulator that translates operating systems concepts into transit-based interactive scenarios. Its main contribution is a simple and visual way to present scheduling behavior such as Round Robin rotation, aging, prioritization, and recovery handling through a web application.
