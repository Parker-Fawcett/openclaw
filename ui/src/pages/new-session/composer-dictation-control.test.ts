/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

const dictationHarness = vi.hoisted(() => ({
  options: null as null | { onCommit: (transcript: string) => void },
}));

vi.mock("../chat/composer-dictation.ts", () => ({
  ComposerDictationController: class {
    constructor(options: { onCommit: (transcript: string) => void }) {
      dictationHarness.options = options;
    }
    update(options: { onCommit: (transcript: string) => void }) {
      dictationHarness.options = options;
    }
    dispose() {}
    handlePointerDown() {}
  },
}));

vi.mock("../chat/composer-microphone-picker.ts", () => ({
  ComposerMicrophonePicker: class {
    devices = [];
    loading = false;
    open = false;
    issue = null;
    handleOpen() {}
    handleClose() {}
    dispose() {}
  },
}));

import { NewSessionDictationControl } from "./composer-dictation-control.ts";

describe("NewSessionDictationControl", () => {
  beforeEach(() => {
    dictationHarness.options = null;
  });

  it("drops a final transcript when cloud placement claims the draft in flight", () => {
    let canCommit = true;
    const insertTranscript = vi.fn(() => "spoken task");
    const onMessage = vi.fn();
    const control = new NewSessionDictationControl({
      textarea: { captureSelection: vi.fn(), insertTranscript } as never,
      getClient: () => ({}) as never,
      isConnected: () => true,
      canCommit: () => canCommit,
      onMessage,
      onError: vi.fn(),
      requestUpdate: vi.fn(),
    });

    control.render();
    canCommit = false;
    dictationHarness.options?.onCommit("spoken task");

    expect(insertTranscript).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });
});
