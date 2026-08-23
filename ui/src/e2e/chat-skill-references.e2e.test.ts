// Control UI E2E tests cover composable skill references in the chat composer.
import path from "node:path";
import type { Locator } from "playwright";
import { expect, it } from "vitest";
import { installMockGateway } from "../test-helpers/control-ui-e2e.ts";
import { createControlUiE2eSuite } from "./control-ui-e2e-suite.test-support.ts";

const suite = createControlUiE2eSuite({
  name: "Control UI skill references",
});

async function setComposerCaret(composer: Locator, caret: number) {
  await composer.evaluate((element, position) => {
    if (!(element instanceof HTMLTextAreaElement)) {
      throw new Error("Chat composer is not a textarea");
    }
    element.setSelectionRange(position, position);
  }, caret);
}

suite.define(() => {
  it("references multiple skills inside a normal prompt and sends the visible tokens", async () => {
    const artifactDir = process.env.OPENCLAW_UI_E2E_ARTIFACT_DIR?.trim();
    await suite.withPage(
      {
        viewport: { width: 1280, height: 900 },
        ...(artifactDir
          ? { recordVideo: { dir: artifactDir, size: { width: 1280, height: 900 } } }
          : {}),
      },
      async ({ page }) => {
        const commands = [
          {
            acceptsArgs: true,
            description: "Pre-commit and ship code review.",
            name: "autoreview",
            skillDisplayName: "Auto Review",
            scope: "both",
            source: "skill",
            skillModelVisible: true,
            textAliases: ["/autoreview"],
          },
          {
            acceptsArgs: true,
            description: "Build and review technical documentation.",
            name: "technical_documentation",
            skillDisplayName: "Technical Documentation",
            scope: "both",
            source: "skill",
            skillModelVisible: true,
            textAliases: ["/technical_documentation"],
          },
          {
            acceptsArgs: true,
            description: "Prepare a detailed status report.",
            name: "status_report",
            skillDisplayName: "Status Report",
            scope: "both",
            source: "skill",
            skillModelVisible: true,
            textAliases: ["/status_report"],
          },
          {
            acceptsArgs: true,
            description: "Exercise wrapped token geometry.",
            name: "wrap",
            skillDisplayName: "Extremely Detailed Wrapped Composition Helper",
            scope: "both",
            source: "skill",
            skillModelVisible: true,
            textAliases: ["/wrap"],
          },
          {
            acceptsArgs: false,
            description: "Show gateway status.",
            name: "status",
            scope: "both",
            source: "native",
            textAliases: ["/status"],
          },
        ];
        const gateway = await installMockGateway(page, {
          deferredMethods: ["chat.send"],
          methodResponses: {
            "chat.startup": {
              agentsList: {
                agents: [{ id: "main", name: "OpenClaw" }],
                defaultId: "main",
                mainKey: "main",
                scope: "agent",
              },
              messages: [],
              metadata: { commands, models: [] },
              sessionId: "skill-reference-session",
              thinkingLevel: null,
            },
            "commands.list": { commands },
          },
        });

        await page.goto(`${suite.server.baseUrl}chat`);
        await gateway.waitForRequest("chat.startup");
        const composer = page.locator(".agent-chat__composer-combobox textarea");
        await composer.fill("Review this with $auto");

        const picker = page.getByRole("listbox", { name: "Skill references" });
        await picker.waitFor({ state: "visible" });
        await expect.poll(() => picker.getByRole("option").count()).toBe(1);
        await expect
          .poll(() => picker.getByRole("option").first().textContent())
          .toContain("Auto Review");
        if (artifactDir) {
          await page.screenshot({
            path: path.join(artifactDir, "skill-reference-picker.png"),
            fullPage: true,
          });
        }
        await composer.press("Enter");
        await expect.poll(() => composer.inputValue()).toBe("Review this with $autoreview ");

        await composer.fill(`${await composer.inputValue()}and $technical`);
        await expect.poll(() => picker.getByRole("option").count()).toBe(1);
        await composer.press("Tab");
        await expect
          .poll(() => composer.inputValue())
          .toBe("Review this with $autoreview and $technical_documentation ");

        if (artifactDir) {
          await page.screenshot({
            path: path.join(artifactDir, "skill-references-selected.png"),
            fullPage: true,
          });
        }

        await page.getByRole("button", { name: "Send message" }).click();
        const request = await gateway.waitForRequest("chat.send");
        expect((request.params as { message?: unknown }).message).toBe(
          "Review this with $autoreview and $technical_documentation",
        );

        await composer.fill("Print $HOME");
        await expect.poll(() => picker.count()).toBe(0);
        await composer.fill("/");
        await page.getByRole("listbox", { name: "Slash commands" }).waitFor({ state: "visible" });
        await expect.poll(() => page.getByRole("option", { name: /\/status/u }).count()).toBe(2);

        const slashOptions = page
          .getByRole("listbox", { name: "Slash commands" })
          .getByRole("option");
        await composer.fill("/sta");
        await expect
          .poll(async () => {
            const names = await slashOptions.locator(".slash-menu-name").allTextContents();
            return { first: names[0], last: names.at(-1) };
          })
          .toEqual({ first: "/status", last: "/status_report" });
        await composer.press("Tab");
        await expect.poll(() => composer.inputValue()).toBe("/status");

        await page.setViewportSize({ width: 420, height: 780 });
        await composer.fill(
          "A wrapped prompt leading into $wrap: then following copy that must share the native textarea wrap.",
        );
        const overlay = page.locator(".agent-chat__composer-draft-overlay");
        const token = overlay.locator(".agent-chat__skill-token");
        await token.waitFor({ state: "visible" });
        await expect.poll(() => token.getAttribute("data-raw")).toBe("$wrap");
        await expect.poll(() => token.evaluate((element) => element.style.top)).not.toBe("");
        await expect
          .poll(() => overlay.textContent())
          .toSatisfy((text) => text?.includes("A wrapped prompt leading into $wrap: then"));
        const [textareaGeometry, overlayGeometry] = await Promise.all([
          composer.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              clientWidth: element.clientWidth,
              font: style.font,
              lineHeight: style.lineHeight,
              overflowWrap: style.overflowWrap,
              paddingInline: style.paddingInline,
              scrollHeight: element.scrollHeight,
              whiteSpace: style.whiteSpace,
            };
          }),
          overlay.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              clientWidth: element.clientWidth,
              font: style.font,
              lineHeight: style.lineHeight,
              overflowWrap: style.overflowWrap,
              paddingInline: style.paddingInline,
              scrollHeight: element.scrollHeight,
              whiteSpace: style.whiteSpace,
            };
          }),
        ]);
        expect(overlayGeometry).toEqual(textareaGeometry);

        const rtlDraft = "שלום עם $wrap: וטקסט נוסף שצריך להישאר מיושר עם שדה הכתיבה.";
        const rtlTokenStart = rtlDraft.indexOf("$wrap");
        const rtlTokenEnd = rtlTokenStart + "$wrap".length;
        const rtlDraftWithoutToken = `${rtlDraft.slice(0, rtlTokenStart)}${rtlDraft.slice(
          rtlTokenEnd,
        )}`;
        await composer.fill(rtlDraft);
        await expect.poll(() => composer.getAttribute("dir")).toBe("rtl");
        await expect.poll(() => overlay.getAttribute("dir")).toBe("rtl");
        const rtlTokenGeometry = await overlay.evaluate((element) => {
          const rtlToken = element.querySelector<HTMLElement>(".agent-chat__skill-token");
          const text = Array.from(element.childNodes).find(
            (node): node is Text => node instanceof Text,
          );
          if (!rtlToken || !text) {
            return null;
          }
          const range = document.createRange();
          range.setStart(text, Number(rtlToken.dataset.start));
          range.setEnd(text, Number(rtlToken.dataset.end));
          const rangeRect = range.getBoundingClientRect();
          const tokenRect = rtlToken.getBoundingClientRect();
          return {
            left: Math.abs(tokenRect.left - rangeRect.left),
            top: Math.abs(tokenRect.top - rangeRect.top),
            width: Math.abs(tokenRect.width - rangeRect.width),
          };
        });
        expect(rtlTokenGeometry).not.toBeNull();
        expect(rtlTokenGeometry?.left).toBeLessThan(1);
        expect(rtlTokenGeometry?.top).toBeLessThan(1);
        expect(rtlTokenGeometry?.width).toBeLessThan(1);

        await setComposerCaret(composer, rtlTokenEnd);
        await composer.press("Backspace");
        await expect.poll(() => composer.inputValue()).toBe(rtlDraftWithoutToken);
        await composer.fill(rtlDraft);
        await setComposerCaret(composer, rtlTokenStart);
        await composer.press("Delete");
        await expect.poll(() => composer.inputValue()).toBe(rtlDraftWithoutToken);
      },
    );
  });
});
