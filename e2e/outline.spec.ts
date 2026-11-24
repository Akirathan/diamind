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

test("bullets are centered on the first line of the text", async () => {
  launched = await launchApp({ DIAMIND_SEED_NODES: "20" });
  const window = await launched.app.firstWindow();
  await window.setViewportSize({ width: 600, height: 800 });
  const wrapped = window.locator('[data-node-id="seed-13"]');
  await expect(wrapped).toBeVisible();
  expect((await wrapped.boundingBox())?.height).toBeGreaterThan(40);

  const offsets = await window.locator("[data-node-id]").evaluateAll((rows) =>
    rows.map((row) => {
      const bullet = row.querySelector('[data-testid="bullet"]') as Element;
      const line = row.querySelector(".cm-line") as Element;
      const bulletBox = bullet.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(line).lineHeight);
      const textCenter = line.getBoundingClientRect().top + lineHeight / 2;
      return bulletBox.top + bulletBox.height / 2 - textCenter;
    }),
  );
  expect(offsets).toHaveLength(20);
  for (const offset of offsets) {
    expect(Math.abs(offset)).toBeLessThanOrEqual(1);
  }
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

  // The node with the cursor keeps its editor.
  await window.getByText("Node 2", { exact: true }).click();

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
