import { useState } from "react";
import { ScenarioWorkspace } from "./components/ScenarioWorkspace";
import { scenarios } from "./scenarios/scenarios";

export function App() {
  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0]?.id ?? "");

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Operating Systems Scheduling Lab</p>
          <h1>Sakay OS</h1>
        </div>
        <span className="phase-badge">Phase 4 Scenario Framework</span>
      </header>

      <ScenarioWorkspace
        activeScenarioId={activeScenarioId}
        onScenarioChange={setActiveScenarioId}
        scenarios={scenarios}
      />
    </main>
  );
}
