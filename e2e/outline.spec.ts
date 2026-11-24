import { expect, test, type Page } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./launch";

const SEED_NODES = 5000;
const MAX_EDITORS = 200;

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

function editorCount(window: Page): Promise<number> {
  return window.locator(".cm-editor").count();
}

async function scrollTo(window: Page, position: "top" | "bottom") {
  const outline = window.getByTestId("outline");
  await outline.evaluate((element, where) => {
    element.scrollTop = where === "top" ? 0 : element.scrollHeight;
  }, position);
}

test("an empty outline shows one empty node to type into", async () => {
  launched = await launchApp();
  const window = await launched.app.firstWindow();
  const content = window.locator(".cm-content");
  await expect(content).toHaveCount(1);
  await expect(content).toHaveText("");

  await content.click();
  await window.keyboard.type("Hello DiaMind");
  await expect(content).toHaveText("Hello DiaMind");
});

test("a large outline renders only a few editors", async () => {
  launched = await launchApp({ DIAMIND_SEED_NODES: String(SEED_NODES) });
  const window = await launched.app.firstWindow();
  await expect(window.getByText("Node 1", { exact: true })).toBeVisible();
  expect(await editorCount(window)).toBeLessThan(MAX_EDITORS);

  // Row heights are estimated until measured, so the bottom can move while scrolling.
  const last = window.getByText(`Node ${SEED_NODES}`, { exact: true });
  await expect(async () => {
    await scrollTo(window, "bottom");
    await expect(last).toBeVisible({ timeout: 200 });
  }).toPass();
  expect(await editorCount(window)).toBeLessThan(MAX_EDITORS);
});

test("text typed into a node survives editor reuse", async () => {
  launched = await launchApp({ DIAMIND_SEED_NODES: String(SEED_NODES) });
  const window = await launched.app.firstWindow();
  const first = window.getByText("Node 1", { exact: true });
  // The editor is as wide as the row, so the click lands behind the text.
  await first.click();
  await window.keyboard.type(" edited");
  await expect(
    window.getByText("Node 1 edited", { exact: true }),
  ).toBeVisible();

  const last = window.getByText(`Node ${SEED_NODES}`, { exact: true });
  await expect(async () => {
    await scrollTo(window, "bottom");
    await expect(last).toBeVisible({ timeout: 200 });
  }).toPass();
  await expect(window.locator('[data-node-id="seed-1"]')).toHaveCount(0);

  await scrollTo(window, "top");
  await expect(
    window.getByText("Node 1 edited", { exact: true }),
  ).toBeVisible();
});
