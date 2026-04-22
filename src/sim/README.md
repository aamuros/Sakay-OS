# Simulation Core

Pure TypeScript scheduling logic belongs here.

Phase 1 starts with Jeepney Bunching:

- deterministic simulation ticks
- Round Robin time quantum behavior
- optional aging boost
- metrics snapshots
- Vitest coverage before UI wiring

Phase 5 adds EDSA Overload:

- multiple corridor route queues
- priority classes with optional preemption
- load-threshold redirection
- per-route queue and wait snapshots
