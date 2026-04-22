import { PlannedScenarioShell } from "./plannedScenarioShell";
import type { ScenarioStageProps } from "./types";

export function MrtBreakdownStage({ scenario }: ScenarioStageProps) {
  return (
    <PlannedScenarioShell
      focusPoints={[
        "Fault handling maps to stalled train segments, fallback routing, and migration of passenger load.",
        "Recovery lessons need stronger shared event history than current single-lane Jeepney demo.",
        "Keeping shell visible now reserves workspace space for outage timeline, alerts, and recovery notes later."
      ]}
      milestones={[
        "Keep framework neutral so failure-state timeline can drop into same stage slot.",
        "Add recovery-focused metrics cards once generic scenario panels prove reusable.",
        "Implement migration logic only after Jeepney simulator remains deterministic under Phase 4 refactor."
      ]}
      readinessNote={
        "Breakdown simulator stays parked until reusable scenario contract and Jeepney behavior both hold."
      }
      scenario={scenario}
      shellCards={[
        {
          title: "Primary pressure",
          tag: "Fault tolerance",
          body: "Breakdown state needs recovery, migration, and fairness after capacity suddenly drops."
        },
        {
          title: "Reusable surface",
          tag: "Scenario shell",
          body: "Planned alerts, metrics, and notes plug into same workspace without special App logic."
        }
      ]}
      statusBody="Placeholder stage proves scenario framework can host non-Jeepney content now."
      statusLabel="Planned rail shell"
    />
  );
}
