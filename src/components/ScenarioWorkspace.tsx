import type { ScenarioDefinition } from "../scenarios/types";

type ScenarioWorkspaceProps = {
  activeScenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  scenarios: ScenarioDefinition[];
};

export function ScenarioWorkspace({
  activeScenarioId,
  onScenarioChange,
  scenarios
}: ScenarioWorkspaceProps) {
  const activeScenario =
    scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0];
  const ActiveStage = activeScenario.Stage;

  return (
    <section className="workspace" aria-label="Scenario workspace">
      <aside className="scenario-list" aria-label="Scenario roadmap">
        <h2>Scenarios</h2>
        <div className="scenario-items">
          {scenarios.map((scenario) => (
            <button
              aria-pressed={scenario.id === activeScenario.id}
              className={`scenario-item ${
                scenario.id === activeScenario.id ? "is-active" : ""
              }`}
              key={scenario.id}
              onClick={() => {
                onScenarioChange(scenario.id);
              }}
              type="button"
            >
              <div>
                <h3>{scenario.name}</h3>
                <p>{scenario.algorithm}</p>
              </div>
              <span>{scenario.status}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="scenario-stage" aria-labelledby="active-scenario">
        <div className="stage-header">
          <div>
            <p className="eyebrow">{activeScenario.concept}</p>
            <h2 id="active-scenario">{activeScenario.name}</h2>
          </div>
          <span>{activeScenario.algorithm}</span>
        </div>

        <ActiveStage scenario={activeScenario} />
      </section>
    </section>
  );
}
