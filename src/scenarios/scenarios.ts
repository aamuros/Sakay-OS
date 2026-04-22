import { EdsaOverloadStage } from "./edsaOverload";
import { JeepneyStage } from "./jeepneyStage";
import { MrtBreakdownStage } from "./mrtBreakdown";
import type { ScenarioDefinition } from "./types";

export const scenarios: ScenarioDefinition[] = [
  {
    id: "jeepney-bunching",
    name: "Jeepney Bunching",
    concept: "Time-sliced scheduling and starvation prevention",
    algorithm: "Round Robin + Aging",
    description:
      "Model the PRC-to-Buendia Makati corridor across A.P. Reyes, Pablo Ocampo, and Chino Roces, then use time quantum scheduling and aging to show how bunching pressure builds and gets corrected.",
    status: "active",
    Stage: JeepneyStage
  },
  {
    id: "edsa-overload",
    name: "EDSA Overload",
    concept: "Priority scheduling and load distribution",
    algorithm: "Priority + Load Balancing",
    description:
      "Model corridor pressure across EDSA, C5, and Quirino, then show how priority classes, optional preemption, and rerouting react to overload.",
    status: "active",
    Stage: EdsaOverloadStage
  },
  {
    id: "mrt-breakdown",
    name: "MRT Breakdown",
    concept: "Fault tolerance and process migration",
    algorithm: "Fault Tolerant Scheduling",
    description:
      "Planned last because migration and recovery add the most complexity.",
    status: "planned",
    Stage: MrtBreakdownStage
  }
];
