/* @vitest-environment jsdom */

import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWorkspaceConflictNotice } from "./chat-workspace-conflict.ts";

const conflict = {
  paths: ["src/local.ts"],
  stagedResultRef: "refs/openclaw/worker-results/claim-test",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "execCommand");
  document.body.replaceChildren();
});

describe("workspace conflict copy actions", () => {
  it.each([
    { copied: true, expected: "Copied!" },
    { copied: false, expected: "Copy failed" },
  ])("shows visible feedback when clipboard success is $copied", async ({ copied, expected }) => {
    const writeText = copied
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new DOMException("Clipboard access denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    const container = document.body.appendChild(document.createElement("div"));
    render(renderWorkspaceConflictNotice({ conflict }), container);

    const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((candidate) =>
      candidate.textContent?.includes("Inspect the first cloud version"),
    );
    button?.click();

    await vi.waitFor(() => expect(button?.textContent?.trim()).toBe(expected));
    expect(button?.getAttribute("aria-label")).toBe(expected);
    expect(writeText).toHaveBeenCalledWith(
      "git show 'refs/openclaw/worker-results/claim-test:src/local.ts'",
    );
  });
});
