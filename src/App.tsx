import { useState } from "react";
import { ScenarioWorkspace } from "./components/ScenarioWorkspace";
import { scenarios } from "./scenarios/scenarios";

function isScenarioEnabled(status: (typeof scenarios)[number]["status"]) {
  return status === "active";
}

function formatScenarioTabStatus(status: (typeof scenarios)[number]["status"]) {
  return status === "active" ? "Active" : "In Progress";
}

export function App() {
  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0]?.id ?? "");
  const activeScenario =
    scenarios.find(
      (scenario) =>
        scenario.id === activeScenarioId && isScenarioEnabled(scenario.status)
    ) ??
    scenarios.find((scenario) => isScenarioEnabled(scenario.status)) ??
    scenarios[0];

  if (!activeScenario) {
    return null;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-copy">
          <p className="eyebrow">Transit Scheduling Lab</p>
          <h1>Sakay OS</h1>
          <p className="app-subtitle">
            Guided transit simulations for scheduling, priority, and load
            balancing concepts.
          </p>
        </div>

        <div className="app-header-meta">
          <span className="phase-badge">Class presentation mode</span>
          <p className="header-note">
            Jeepney Bunching and EDSA Overload are active lessons. MRT
            Breakdown remains a roadmap tab.
          </p>
        </div>

        <nav className="scenario-strip" aria-label="Scenario selection">
          {scenarios.map((scenario) => {
            const isEnabled = isScenarioEnabled(scenario.status);

            return (
              <button
                aria-disabled={!isEnabled}
                aria-pressed={isEnabled && scenario.id === activeScenario.id}
                className={`scenario-tab ${
                  scenario.id === activeScenario.id ? "is-active" : ""
                } ${isEnabled ? "" : "is-disabled"}`.trim()}
                disabled={!isEnabled}
                key={scenario.id}
                onClick={() => {
                  if (!isEnabled) {
                    return;
                  }

                  setActiveScenarioId(scenario.id);
                }}
                type="button"
              >
                <div className="scenario-tab-copy">
                  <strong>{scenario.name}</strong>
                  <span>{scenario.concept}</span>
                </div>
                <span className="scenario-tab-status">
                  {formatScenarioTabStatus(scenario.status)}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <ScenarioWorkspace activeScenario={activeScenario} />
    </main>
  );
}
