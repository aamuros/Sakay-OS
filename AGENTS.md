# Repository Guidelines

## Project Structure & Module Organization
Core app code lives in `src/`. Use `src/components/` for React UI like `ScenarioWorkspace.tsx`, `src/scenarios/` for static scenario data and shared types, `src/sim/` for pure scheduling logic, and `src/styles/` for global CSS. Keep simulation code framework-agnostic so it can be tested without React. Build output goes to `dist/`; do not edit generated files there.

## Build, Test, and Development Commands
- `npm install` installs project dependencies.
- `npm run dev` starts the Vite development server for local UI work.
- `npm run build` runs TypeScript project builds, then creates the production bundle.
- `npm run lint` performs strict TypeScript checks for both app and Vite config files.
- `npm run test` runs the Vitest suite in `jsdom`.

Run these from the repository root.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode assumptions in mind. Follow the existing style: 2-space indentation, double quotes, semicolons, and small typed functions. Name React components in `PascalCase`, utility values and functions in `camelCase`, and keep CSS classes lowercase with hyphenated names such as `.scenario-item`. Scenario IDs use kebab-case strings like `jeepney-bunching`. Prefer colocated types when small; otherwise place shared scenario types in `src/scenarios/types.ts`.

## Testing Guidelines
Vitest is the current test framework. Place tests next to the module they cover using `*.test.ts`, as in `src/scenarios/scenarios.test.ts`. Prioritize tests for pure scheduling logic in `src/sim/` before wiring behavior into the UI; this matches the roadmap and `src/sim/README.md`. Add regression coverage for deterministic ticks, quantum expiration, aging behavior, and metrics snapshots as the simulator grows.

## Commit & Pull Request Guidelines
Local `.git` metadata is not present in this workspace, so commit conventions cannot be inferred from history here. Use short, imperative commit subjects such as `Add Round Robin scheduler tests`. Keep commits focused on one change. PRs should include a brief summary, linked issue or roadmap phase, test evidence (`npm run test`, `npm run build`), and screenshots for UI changes.

## Architecture Notes
`ROADMAP.md` is the source of truth for scope. Keep Jeepney Bunching as the only active implementation path until the pure scheduler is stable and tested; do not expand EDSA or MRT features early.

## Codex Behavior
Do not use the Superpowers plugin or Superpowers skills in this repository unless the user explicitly asks to re-enable them.
