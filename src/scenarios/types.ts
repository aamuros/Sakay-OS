import type { ComponentType } from "react";

export type ScenarioStatus = "active" | "in-progress";

export type ScenarioSummary = {
  id: string;
  name: string;
  concept: string;
  algorithm: string;
  description: string;
  status: ScenarioStatus;
};

export type ScenarioStageProps = {
  scenario: ScenarioSummary;
};

export type ScenarioDefinition = ScenarioSummary & {
  Stage: ComponentType<ScenarioStageProps>;
};
