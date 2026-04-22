import type { ScenarioDefinition } from "../scenarios/types";

type ScenarioWorkspaceProps = {
  activeScenario: ScenarioDefinition;
};

function formatStageStatus(status: ScenarioDefinition["status"]) {
  return status === "active" ? "Live demo" : "In progress";
}

export function ScenarioWorkspace({ activeScenario }: ScenarioWorkspaceProps) {
  const ActiveStage = activeScenario.Stage;

  return (
    <section className="workspace" aria-label="Scenario workspace">
      <section className="scenario-stage" aria-labelledby="active-scenario">
        <div className="stage-header">
          <div className="stage-header-copy">
            <p className="eyebrow">{activeScenario.concept}</p>
            <h2 id="active-scenario">{activeScenario.name}</h2>
            <p className="stage-description">{activeScenario.description}</p>
          </div>

          <div className="stage-pill-row" aria-label="Scenario metadata">
            <span>{activeScenario.algorithm}</span>
            <span>{formatStageStatus(activeScenario.status)}</span>
          </div>
        </div>

        <ActiveStage scenario={activeScenario} />
      </section>
    </section>
  );
}
