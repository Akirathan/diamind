import { expect, test, type Locator, type Page } from "@playwright/test";
import { parseOutlineJson, type DiamindApi } from "@/shared/api";
import { launchApp, type LaunchedApp } from "./launch";
import {
  expectCursor,
  expectOutline,
  putCursor,
  scrollTo,
  settle,
} from "./outline-page";

/** Longer than the delay of the write queue. */
const SAVE_WAIT_MS = 1000;
const MOD = process.platform === "darwin" ? "Meta" : "Control";

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

// Depths of the seed nodes: 0 1 2 2 1, repeated.
async function launchSeeded(count = 10): Promise<Page> {
  launched = await launchApp({ DIAMIND_SEED_NODES: String(count) });
  const page = await launched.app.firstWindow();
  await expect(row(page, "seed-1")).toBeVisible();
  return page;
}

function row(page: Page, id: string): Locator {
  return page.locator(`[data-node-id="${id}"]`);
}

function title(page: Page): Locator {
  return page.locator('[data-title="true"] .cm-content');
}

function button(page: Page, name: "Back" | "Forward" | "Up"): Locator {
  return page.getByRole("button", { name, exact: true });
}

async function zoomInto(page: Page, id: string): Promise<void> {
  await row(page, id).getByRole("button", { name: "Zoom in" }).click();
  await expect(row(page, id)).toHaveAttribute("data-title", "true");
}

function scrollTop(page: Page): Promise<number> {
  return page
    .getByTestId("outline")
    .evaluate((element) => Math.round(element.scrollTop));
}

const NODE_1 = ["Node 1", "  Node 2", "    Node 3", "    Node 4", "  Node 5"];
const NODE_2 = ["Node 2", "  Node 3", "  Node 4"];

test("a click on a bullet zooms, the buttons navigate", async () => {
  const page = await launchSeeded();
  for (const name of ["Back", "Forward", "Up"] as const) {
    await expect(button(page, name)).toBeDisabled();
  }
  await expect(title(page)).toHaveCount(0);

  await zoomInto(page, "seed-1");
  await expectOutline(page, NODE_1);
  await expect(title(page)).toHaveText("Node 1");
  await expectCursor(page, "Node 1|");
  await zoomInto(page, "seed-2");
  await expectOutline(page, NODE_2);

  await button(page, "Back").click();
  await expectOutline(page, NODE_1);
  await button(page, "Back").click();
  await expect(row(page, "seed-6")).toBeVisible();
  await expect(button(page, "Back")).toBeDisabled();
  await expect(button(page, "Up")).toBeDisabled();

  await button(page, "Forward").click();
  await button(page, "Forward").click();
  await expectOutline(page, NODE_2);
  await expect(button(page, "Forward")).toBeDisabled();

  await button(page, "Up").click();
  await expectOutline(page, NODE_1);
  await expectCursor(page, "Node 2|");
  await button(page, "Up").click();
  await expect(row(page, "seed-6")).toBeVisible();
  await expect(title(page)).toHaveCount(0);
});

test("shortcuts go back and forward", async () => {
  const page = await launchSeeded();
  await zoomInto(page, "seed-2");
  await page.keyboard.press(`${MOD}+BracketLeft`);
  await expect(row(page, "seed-6")).toBeVisible();
  await page.keyboard.press(`${MOD}+BracketRight`);
  await expectOutline(page, NODE_2);
});

test("the collapse state is kept", async () => {
  const page = await launchSeeded();
  const arrow = (id: string): Locator =>
    row(page, id).getByRole("button", { name: "Show children" });
  await arrow("seed-2").click();
  await zoomInto(page, "seed-1");
  await expectOutline(page, ["Node 1", "  Node 2", "  Node 5"]);
  // A collapsed node that is zoomed into shows its children.
  await zoomInto(page, "seed-2");
  await expectOutline(page, NODE_2);
  await button(page, "Back").click();
  await expectOutline(page, ["Node 1", "  Node 2", "  Node 5"]);
  await expect(arrow("seed-2")).toHaveAttribute("aria-expanded", "false");
});

test("the title is editable", async () => {
  const page = await launchSeeded();
  await zoomInto(page, "seed-2");
  await page.keyboard.type("!");
  await expect(title(page)).toHaveText("Node 2!");
  await button(page, "Back").click();
  await expect(row(page, "seed-2")).toHaveText("Node 2!");
});

test("editing keys stay inside of the zoomed node", async () => {
  const page = await launchSeeded();
  await zoomInto(page, "seed-2");
  await expect(page.getByTestId("indent-line")).toHaveCount(0);

  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await putCursor(page, "seed-3", 0);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Backspace");
  await expectOutline(page, NODE_2);

  await page.keyboard.press("ArrowUp");
  await expectCursor(page, "|Node 2");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await expectCursor(page, "|Node 3");

  await putCursor(page, "seed-4", 0);
  await page.keyboard.press("Tab");
  await expectOutline(page, ["Node 2", "  Node 3", "    Node 4"]);
  await expect(page.getByTestId("indent-line")).toHaveCount(1);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expectOutline(page, NODE_2);

  // Enter in the last empty child of the local root does nothing.
  await putCursor(page, "seed-4", 6);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expectOutline(page, [...NODE_2, "  "]);

  await putCursor(page, "seed-2", 6);
  await page.keyboard.press("Enter");
  await page.keyboard.type("first");
  await expectOutline(page, [
    "Node 2",
    "  first",
    "  Node 3",
    "  Node 4",
    "  ",
  ]);
});

test("a zoomed node without children has one empty child", async () => {
  const page = await launchSeeded();
  await zoomInto(page, "seed-3");
  await expectOutline(page, ["Node 3", "  "]);
  await expectCursor(page, "|");
  await button(page, "Back").click();
  await expect(row(page, "seed-6")).toBeVisible();
  await expect(page.locator("[data-node-id]")).toHaveCount(10);
  await expectCursor(page, "Node 3|");

  await zoomInto(page, "seed-3");
  await page.keyboard.type("child");
  await button(page, "Back").click();
  await expect(page.locator("[data-node-id]")).toHaveCount(11);
});

test("undo of a change outside of the zoomed node keeps the view", async () => {
  const page = await launchSeeded();
  await putCursor(page, "seed-6", 6);
  await page.keyboard.type("!");
  await zoomInto(page, "seed-1");
  await putCursor(page, "seed-5", 2);
  await page.keyboard.press(`${MOD}+z`);
  await settle(page);
  await expectOutline(page, NODE_1);
  await expectCursor(page, "No|de 5");
  await button(page, "Back").click();
  await expect(row(page, "seed-6")).toHaveText("Node 6");
});

test("undo that deletes the zoomed node leaves it", async () => {
  const page = await launchSeeded(5);
  await putCursor(page, "seed-5", 6);
  await page.keyboard.press("Enter");
  const newRow = page.locator("[data-node-id]").last();
  await expect(newRow).not.toHaveAttribute("data-node-id", "seed-5");
  await newRow.getByRole("button", { name: "Zoom in" }).click();
  await expectOutline(page, ["", "  "]);

  await page.keyboard.press(`${MOD}+z`);
  await expectOutline(page, NODE_1);
  await expect(title(page)).toHaveText("Node 1");
  await expectCursor(page, "Node 5|");
  await expect(page.locator("[data-node-id]")).toHaveCount(5);
});

test("the scroll position is restored", async () => {
  const page = await launchSeeded(1000);
  await scrollTo(page, 6000);
  // Rows above the view are measured, which can correct the position.
  await page.waitForTimeout(300);
  const before = await scrollTop(page);
  const visible = await page.evaluate(() => {
    const { left, top } = document
      .querySelector('[data-testid="outline"]')!
      .getBoundingClientRect();
    const element = document.elementFromPoint(left + 200, top + 300);
    return element?.closest("[data-node-id]")?.getAttribute("data-node-id");
  });
  await zoomInto(page, visible as string);
  await expect.poll(() => scrollTop(page)).toBe(0);
  await button(page, "Back").click();
  await expect.poll(() => scrollTop(page)).toBe(before);
  await expect(row(page, visible as string)).toBeInViewport();
});

test("a restart restores the zoomed node and the history", async () => {
  launched = await launchApp();
  let page = await launched.app.firstWindow();
  await page.locator(".cm-content").first().click();
  await page.keyboard.type("a");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("b");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("c");
  await page
    .locator("[data-node-id]", { hasText: "a" })
    .getByRole("button", { name: "Zoom in" })
    .click();
  await expectOutline(page, ["a", "  b", "    c"]);
  await page
    .locator("[data-node-id]", { hasText: "b" })
    .getByRole("button", { name: "Zoom in" })
    .click();
  await expectOutline(page, ["b", "  c"]);

  // Right before the quit, without the delay of the save.
  await button(page, "Back").click();
  await launched.restart();
  page = await launched.app.firstWindow();
  await expectOutline(page, ["a", "  b", "    c"]);
  await button(page, "Forward").click();
  await expectOutline(page, ["b", "  c"]);
  await button(page, "Back").click();
  await button(page, "Back").click();
  await expectOutline(page, ["a", "  b", "    c"]);
  await expect(title(page)).toHaveCount(0);
});

test("a seeded session does not change the saved zoom", async () => {
  launched = await launchApp();
  let page = await launched.app.firstWindow();
  await page.locator(".cm-content").first().click();
  await page.keyboard.type("mine");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(title(page)).toHaveText("mine");

  await launched.restart({ DIAMIND_SEED_NODES: "20" });
  page = await launched.app.firstWindow();
  await expect(title(page)).toHaveCount(0);
  await zoomInto(page, "seed-1");
  await page.waitForTimeout(SAVE_WAIT_MS);

  await launched.restart({ DIAMIND_SEED_NODES: "0" });
  page = await launched.app.firstWindow();
  await expect(title(page)).toHaveText("mine");
  const { nodes } = parseOutlineJson(
    await page.evaluate(() =>
      (window as unknown as { diamind: DiamindApi }).diamind.loadOutline(),
    ),
  );
  expect(nodes.map((node) => node.text).sort()).toEqual(["", "", "mine"]);
});
