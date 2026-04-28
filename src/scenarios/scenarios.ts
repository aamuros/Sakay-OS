import { EdsaOverloadStage } from "./edsaOverload";
import { JeepneyStage } from "./jeepneyStage";
import { MrtBreakdownStage } from "./mrtBreakdown";
import type { ScenarioDefinition } from "./types";

export const scenarios: ScenarioDefinition[] = [
  {
    id: "jeepney-bunching",
    name: "Jeepney Bunching",
    concept: "Time-Sliced Scheduling and Starvation Prevention",
    algorithm: "Round Robin + Aging",
    description:
      "Follow the PRC-to-Buendia corridor and watch Round Robin time slices rotate jeepneys while aging prevents one unit from waiting too long.",
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
      "Inject an MRT station failure, move passengers to backup routes, and watch degraded service recover.",
    status: "active",
    Stage: MrtBreakdownStage
  }
];
