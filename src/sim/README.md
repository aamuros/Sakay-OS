# Simulation Core

This folder is the logic layer of Sakay OS.

The React interface shows the results, but the files here decide what happens in each simulation tick.

## In Simple Terms

- Scheduler files contain the rules for each scenario.
- Shared types describe the data used by the simulations.
- Playback code turns scheduler output into UI-friendly frames.
- Test files check if the simulation behaves correctly.

## Current Scenarios In This Folder

### Jeepney Bunching

Main focus of the project:

- deterministic ticks
- Round Robin time slices
- optional aging boost
- metrics snapshots

### EDSA Overload

Adds:

- multiple route queues
- priority classes
- optional preemption
- rerouting when a route is overloaded

### MRT Breakdown

Adds:

- station failure windows
- passenger migration to backup routes
- degraded service and recovery
- dropped passenger tracking

## Why This Folder Matters

Keeping the simulation code separate from React makes the project easier to:

- test
- explain
- improve without breaking the UI
