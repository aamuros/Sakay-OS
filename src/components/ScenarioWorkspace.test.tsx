import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScenarioWorkspace } from "./ScenarioWorkspace";
import { App } from "../App";
import { scenarios } from "../scenarios/scenarios";

const tickDurationMs = 900;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function getButton(container: HTMLDivElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label
  );

  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }

  return button;
}

function getScenarioButton(container: HTMLDivElement, name: string) {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>(".scenario-tab")
  ).find((candidate) => candidate.querySelector("strong")?.textContent?.trim() === name);

  if (!button) {
    throw new Error(`Missing scenario button: ${name}`);
  }

  return button;
}

function setRangeValue(input: HTMLInputElement, value: number) {
  input.value = value.toString();
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ScenarioWorkspace", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets safely when controls shrink the playback after a long run", async () => {
    vi.useFakeTimers();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<ScenarioWorkspace activeScenario={scenarios[0]} />);
    });

    const sliders = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="range"]')
    );

    expect(sliders).toHaveLength(4);

    await act(async () => {
      setRangeValue(sliders[0], 4);
      setRangeValue(sliders[2], 6);
    });

    await act(async () => {
      getButton(container, "Start").click();
    });

    await act(async () => {
      vi.advanceTimersByTime(48 * tickDurationMs);
    });

    await act(async () => {
      setRangeValue(sliders[0], 1);
      setRangeValue(sliders[2], 2);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const buttonLabels = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".control-buttons button")
    ).map((button) => button.textContent?.trim() ?? "");
    const timelineTick =
      container.querySelector(".timeline-copy strong")?.textContent?.trim() ?? "";

    expect(timelineTick).toBe("Tick 0 / 17");
    expect(buttonLabels).toEqual(["Resume", "Pause", "Reset"]);

    await act(async () => {
      root.unmount();
    });

    container.remove();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps in-progress scenarios visible but disabled in the header switcher", async () => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const edsaButton = getScenarioButton(container, "EDSA Overload");
    const mrtButton = getScenarioButton(container, "MRT Breakdown");

    expect(edsaButton.disabled).toBe(true);
    expect(mrtButton.disabled).toBe(true);
    expect(edsaButton.textContent).toContain("In Progress");
    expect(mrtButton.textContent).toContain("In Progress");

    await act(async () => {
      edsaButton.click();
      mrtButton.click();
    });

    expect(
      container.querySelector("#active-scenario")?.textContent?.trim()
    ).toBe("Jeepney Bunching");
    expect(container.textContent).toContain(
      "Time-Sliced Scheduling with Starvation Prevention"
    );

    await act(async () => {
      root.unmount();
    });

    container.remove();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders the jeepney lesson with clear queue and starvation surfaces", async () => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<ScenarioWorkspace activeScenario={scenarios[0]} />);
    });

    expect(container.textContent).toContain(
      "Time-Sliced Scheduling with Starvation Prevention"
    );
    expect(container.textContent).toContain("Ready queue");
    expect(container.textContent).toContain("Dispatch order");
    expect(container.textContent).toContain("Starvation prevention");
    expect(container.textContent).toContain("Scheduling trace");

    await act(async () => {
      root.unmount();
    });

    container.remove();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });
});
