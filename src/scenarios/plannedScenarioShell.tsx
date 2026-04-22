import type { ReactNode } from "react";
import type { ScenarioStageProps } from "./types";

type ShellCard = {
  title: string;
  tag: string;
  body: string;
};

type PlannedScenarioShellProps = ScenarioStageProps & {
  statusLabel: string;
  statusBody: string;
  focusPoints: string[];
  shellCards: ShellCard[];
  milestones: string[];
  readinessNote: ReactNode;
};

export function PlannedScenarioShell({
  scenario,
  statusLabel,
  statusBody,
  focusPoints,
  shellCards,
  milestones,
  readinessNote
}: PlannedScenarioShellProps) {
  return (
    <>
      <section className="learning-controls" aria-label="Scenario shell status">
        <div className="panel-section-header">
          <div>
            <p className="eyebrow">Phase 4 shell</p>
            <h3>Framework-ready placeholder</h3>
          </div>
          <p>{statusBody}</p>
        </div>

        <div className="shell-card-grid">
          <article className="shell-card is-accent">
            <span>{statusLabel}</span>
            <h4>{scenario.name}</h4>
            <p>{scenario.description}</p>
          </article>

          {shellCards.map((card) => (
            <article className="shell-card" key={card.title}>
              <span>{card.tag}</span>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="live-grid">
        <section className="route-preview" aria-label={`${scenario.name} focus areas`}>
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">Target systems lesson</p>
              <h3>What this shell will teach later</h3>
            </div>
            <p>Content shell live now. Simulation hooks come after Jeepney stays stable.</p>
          </div>

          <div className="note-stack">
            {focusPoints.map((point) => (
              <p key={point}>{point}</p>
            ))}
          </div>
        </section>

        <aside className="queue-panel" aria-label={`${scenario.name} implementation milestones`}>
          <div className="queue-panel-header">
            <p className="eyebrow">Delivery gate</p>
            <h3>Milestones before activation</h3>
          </div>

          <div className="queue-list">
            {milestones.map((milestone, index) => (
              <article className="queue-item" key={milestone}>
                <span>M{index + 1}</span>
                <div>
                  <strong>Pending</strong>
                  <p>{milestone}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="queue-active-card">
            <span>Readiness rule</span>
            <strong>Jeepney first</strong>
            <p>{readinessNote}</p>
          </div>
        </aside>
      </div>

      <div className="panel-grid">
        <section className="info-panel">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">OS mapping</p>
              <h3>Why this scenario exists</h3>
            </div>
            <p>Framework keeps shell visible without shipping unfinished simulator logic.</p>
          </div>

          <div className="note-stack">
            <p>{scenario.concept}</p>
            <p>{scenario.algorithm}</p>
          </div>
        </section>

        <section className="info-panel">
          <div className="panel-section-header">
            <div>
              <p className="eyebrow">Shared contract</p>
              <h3>Plug-in expectations</h3>
            </div>
            <p>Each scenario provides metadata plus stage component. Workspace shell stays same.</p>
          </div>

          <div className="note-stack">
            <p>Scenario switcher loads same header, shell, and stage slot for every route.</p>
            <p>Future sim only replaces placeholder content inside this slot.</p>
          </div>
        </section>
      </div>
    </>
  );
}
