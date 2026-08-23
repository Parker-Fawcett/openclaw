/* @vitest-environment jsdom */

import type { ProgressCard } from "@openclaw/gateway-protocol";
import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderSessionProgressCard } from "./session-progress-card.ts";

const progressCard: ProgressCard = {
  sessionKey: "agent:main:work",
  revision: 2,
  updatedAt: 1,
  markdown: '**Focused change**\n\n<progress value="1" max="3"></progress>',
  steps: [
    { step: "Inspect the route", status: "completed" },
    { step: "Wire the checklist", status: "in_progress" },
    { step: "Run focused tests", status: "pending" },
  ],
};

describe("renderSessionProgressCard", () => {
  it("renders sanitized markdown and one accessible typed checklist", () => {
    const container = document.createElement("div");
    render(renderSessionProgressCard(progressCard, "rail"), container);

    const card = container.querySelector(".session-progress-card");
    expect(card?.getAttribute("aria-label")).toBe("1 of 3 completed");
    expect(card?.querySelector("strong")?.textContent).toBe("Focused change");
    expect(card?.querySelector("progress")?.getAttribute("value")).toBe("1");
    expect(card?.querySelectorAll(".session-progress-card__count")).toHaveLength(0);
    expect(
      [...(card?.querySelectorAll(".session-progress-card__step") ?? [])].map((step) => ({
        label: step.getAttribute("aria-label"),
        status: [...step.classList].find((name) =>
          name.startsWith("session-progress-card__step--"),
        ),
      })),
    ).toEqual([
      {
        label: "Inspect the route, completed",
        status: "session-progress-card__step--completed",
      },
      {
        label: "Wire the checklist, in progress",
        status: "session-progress-card__step--in_progress",
      },
      {
        label: "Run focused tests, pending",
        status: "session-progress-card__step--pending",
      },
    ]);
  });

  it("opens active composer progress as a native disclosure without a progress bar", () => {
    const container = document.createElement("div");
    render(
      renderSessionProgressCard(
        { ...progressCard, markdown: "Working through the task." },
        "composer",
      ),
      container,
    );

    const card = container.querySelector<HTMLDetailsElement>(
      '[data-progress-card-placement="composer"]',
    );
    expect(card?.open).toBe(true);
    expect(card?.dataset.complete).toBe("false");
    expect(card?.querySelector("summary")?.textContent).toContain("Task progress");
    expect(card?.querySelector("progress")).toBeNull();
    expect(card?.querySelectorAll(".session-progress-card__step")).toHaveLength(3);
  });

  it("starts completed composer progress collapsed", () => {
    const container = document.createElement("div");
    render(
      renderSessionProgressCard(
        {
          ...progressCard,
          steps: progressCard.steps?.map((step) =>
            Object.assign({}, step, { status: "completed" as const }),
          ),
        },
        "composer",
      ),
      container,
    );

    const card = container.querySelector<HTMLDetailsElement>(
      '[data-progress-card-placement="composer"]',
    );
    expect(card?.open).toBe(false);
    expect(card?.dataset.complete).toBe("true");
  });

  it("preserves the operator disclosure choice across progress updates", () => {
    const container = document.createElement("div");
    render(renderSessionProgressCard(progressCard, "composer"), container);
    const card = container.querySelector<HTMLDetailsElement>(
      '[data-progress-card-placement="composer"]',
    );
    expect(card?.open).toBe(true);
    card!.open = false;

    render(
      renderSessionProgressCard(
        {
          ...progressCard,
          revision: progressCard.revision + 1,
          steps: progressCard.steps?.map((step, index) =>
            index === 1 ? { ...step, step: "Wire the updated checklist" } : step,
          ),
        },
        "composer",
      ),
      container,
    );

    expect(
      container.querySelector<HTMLDetailsElement>('[data-progress-card-placement="composer"]')
        ?.open,
    ).toBe(false);
  });

  it("uses the default disclosure state for a different session", () => {
    const container = document.createElement("div");
    render(renderSessionProgressCard(progressCard, "composer"), container);
    const first = container.querySelector<HTMLDetailsElement>(
      '[data-progress-card-placement="composer"]',
    );
    first!.open = false;

    render(
      renderSessionProgressCard({ ...progressCard, sessionKey: "agent:main:next" }, "composer"),
      container,
    );

    expect(
      container.querySelector<HTMLDetailsElement>('[data-progress-card-placement="composer"]')
        ?.open,
    ).toBe(true);
  });
});
