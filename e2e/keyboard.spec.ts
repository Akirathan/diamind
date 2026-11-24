import { expect, test, type Page } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./launch";
import {
  cursorText,
  expectCursor,
  expectOutline,
  outlineText,
  putCursor,
  scrollTo,
  settle,
} from "./outline-page";

const UNDO = "ControlOrMeta+z";
const REDO = "ControlOrMeta+Shift+z";

let launched: LaunchedApp | undefined;

async function launch(seedNodes: number): Promise<Page> {
  launched = await launchApp({ DIAMIND_SEED_NODES: String(seedNodes) });
  const page = await launched.app.firstWindow();
  await expect(page.locator(".cm-content").first()).toBeVisible();
  return page;
}

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

const SEED = [
  "Node 1",
  "  Node 2",
  "    Node 3",
  "    Node 4",
  "  Node 5",
  "Node 6",
];

test("Enter at the end creates a sibling below, or a first child", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-3", 6);
  await page.keyboard.press("Enter");
  await expectCursor(page, "|");
  await page.keyboard.type("new");
  await expectOutline(page, [...SEED.slice(0, 3), "    new", ...SEED.slice(3)]);

  await putCursor(page, "seed-1", 6);
  await page.keyboard.press("Enter");
  await page.keyboard.type("child");
  await expectCursor(page, "child|");
  await expectOutline(page, [
    "Node 1",
    "  child",
    ...SEED.slice(1, 3),
    "    new",
    ...SEED.slice(3),
  ]);
});

test("Enter at the beginning creates a sibling above", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-5", 0);
  await page.keyboard.press("Enter");
  await expectCursor(page, "|Node 5");
  await expectOutline(page, [...SEED.slice(0, 4), "  ", ...SEED.slice(4)]);
});

test("Enter in the middle splits the node", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-5", 2);
  await page.keyboard.press("Enter");
  await expectCursor(page, "|de 5");
  await expectOutline(page, [...SEED.slice(0, 4), "  No", "  de 5", "Node 6"]);
  await expect(page.locator('[data-node-id="seed-5"]')).toHaveText("No");
});

test("Enter in the middle moves the children to the second part", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-2", 2);
  await page.keyboard.press("Enter");
  await expectCursor(page, "|de 2");
  await expectOutline(page, ["Node 1", "  No", "  de 2", ...SEED.slice(2)]);
  await page.keyboard.press(UNDO);
  await expectOutline(page, SEED);
  await expectCursor(page, "No|de 2");

  const rows = page.locator("[data-node-id]");
  await rows.nth(1).getByRole("button", { name: "Show children" }).click();
  await putCursor(page, "seed-2", 2);
  await page.keyboard.press("Enter");
  await expectOutline(page, ["Node 1", "  No", "  de 2", "  Node 5", "Node 6"]);
  await expect(
    rows.nth(1).getByRole("button", { name: "Show children" }),
  ).toHaveCount(0);
  await expect(
    rows.nth(2).getByRole("button", { name: "Show children" }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("Enter in an empty last child unindents it until the top level", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-4", 6);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expectCursor(page, "|");
  await expectOutline(page, [...SEED.slice(0, 4), "  ", ...SEED.slice(4)]);

  await putCursor(page, "seed-6", 6);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("last");
  await expectCursor(page, "last|");
  await expectOutline(page, [
    ...SEED.slice(0, 4),
    "  ",
    ...SEED.slice(4),
    "last",
  ]);
});

test("Shift + Enter does not create a line break", async () => {
  const page = await launch(2);
  await putCursor(page, "seed-2", 2);
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("x");
  await expectCursor(page, "Nox|de 2");
  await expect(page.locator(".cm-line")).toHaveCount(2);
});

test("Backspace at the beginning merges into the upper node", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-5", 0);
  await page.keyboard.press("Backspace");
  await expectCursor(page, "Node 4|Node 5");
  await expectOutline(page, [
    ...SEED.slice(0, 3),
    "    Node 4Node 5",
    "Node 6",
  ]);

  await page.keyboard.press("Backspace");
  await expectCursor(page, "Node |Node 5");

  await putCursor(page, "seed-1", 0);
  await page.keyboard.press("Backspace");
  await expectCursor(page, "|Node 1");
});

test("Tab and Shift + Tab keep the cursor, also when they are rejected", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-6", 3);
  await page.keyboard.press("Tab");
  await expectCursor(page, "Nod|e 6");
  await expectOutline(page, [...SEED.slice(0, 5), "  Node 6"]);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expectOutline(page, [...SEED.slice(0, 5), "    Node 6"]);
  await expectCursor(page, "Nod|e 6");

  await putCursor(page, "seed-2", 1);
  await page.keyboard.press("Shift+Tab");
  await expectCursor(page, "N|ode 2");
  await expectOutline(page, [
    "Node 1",
    "  Node 5",
    "    Node 6",
    "Node 2",
    "  Node 3",
    "  Node 4",
  ]);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("x");
  await expectCursor(page, "Nx|ode 2");
});

test("Up and Down move between the nodes", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-3", 4);
  await page.keyboard.press("ArrowDown");
  await expectCursor(page, "|Node 4");
  await page.keyboard.press("ArrowDown");
  await expectCursor(page, "|Node 5");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await expectCursor(page, "|Node 4");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expectCursor(page, "|Node 2");
});

test("Up and Down first move between the visual lines of wrapped text", async () => {
  const page = await launch(15);
  await page.setViewportSize({ width: 600, height: 800 });
  const wrapped = page.locator('[data-node-id="seed-13"]');
  expect((await wrapped.boundingBox())?.height).toBeGreaterThan(60);

  await putCursor(page, "seed-12", 0);
  let lines = 0;
  do {
    await page.keyboard.press("ArrowDown");
    lines++;
  } while ((await cursorText(page))?.replace("|", "").startsWith("Node 13 "));
  await expectCursor(page, "|Node 14");
  expect(lines).toBeGreaterThan(3);

  await putCursor(page, "seed-13", 0);
  await page.keyboard.press("ArrowDown");
  const second = await cursorText(page);
  expect(second).not.toMatch(/^\|/);
  expect(second).toContain("Node 13 ");
  await page.keyboard.press("ArrowUp");
  expect(await cursorText(page)).toMatch(/^\|Node 13 /);
  await page.keyboard.press("ArrowUp");
  await expectCursor(page, "|Node 12");
});

test("pasted lines become nodes", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-5", 4);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "A\r\n\nB\nC\n");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expectCursor(page, "C| 5");
  await expectOutline(page, [
    ...SEED.slice(0, 4),
    "  NodeA",
    "  B",
    "  C 5",
    "Node 6",
  ]);
  await page.keyboard.press(UNDO);
  await expectOutline(page, SEED);
  await expectCursor(page, "Node| 5");
});

test("a line break never gets into a node by a drop or an input method", async () => {
  const page = await launch(2);
  await putCursor(page, "seed-2", 4);
  await page.keyboard.insertText("a\nb");
  await expectCursor(page, "Nodea b| 2");
  await expect(page.locator(".cm-line")).toHaveCount(2);
});

test("undo and redo work for each key", async () => {
  const page = await launch(6);
  const steps: { id: string; offset: number; key: string }[] = [
    { id: "seed-5", offset: 2, key: "Enter" },
    { id: "seed-4", offset: 0, key: "Enter" },
    { id: "seed-6", offset: 6, key: "Enter" },
    { id: "seed-4", offset: 0, key: "Backspace" },
    { id: "seed-6", offset: 1, key: "Tab" },
    { id: "seed-3", offset: 3, key: "Shift+Tab" },
  ];
  for (const { id, offset, key } of steps) {
    const before = await outlineText(page);
    await putCursor(page, id, offset);
    const cursorBefore = (await cursorText(page)) as string;
    await page.keyboard.press(key);
    await expect.poll(() => outlineText(page)).not.toEqual(before);
    const after = await outlineText(page);
    const cursorAfter = (await cursorText(page)) as string;

    await page.keyboard.press(UNDO);
    await expectOutline(page, before);
    await expectCursor(page, cursorBefore);
    await page.keyboard.press(REDO);
    await expectOutline(page, after);
    await expectCursor(page, cursorAfter);
    await page.keyboard.press(UNDO);
    await expectOutline(page, before);
  }
});

test("typing is one undo step until the cursor moves", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-6", 6);
  await page.keyboard.type("ab");
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  await page.keyboard.type("cd");
  await expectCursor(page, "Node 6acd|b");
  await page.keyboard.press(UNDO);
  await expectCursor(page, "Node 6a|b");
  await page.keyboard.press(UNDO);
  await expectCursor(page, "Node 6|");
  await page.keyboard.press(UNDO);
  await expectCursor(page, "Node 6|");
  await page.keyboard.press(REDO);
  await expectCursor(page, "Node 6ab|");
  await page.keyboard.press(REDO);
  await expectCursor(page, "Node 6acd|b");
  await page.keyboard.press(REDO);
  await expectCursor(page, "Node 6acd|b");
});

test("Undo of the application menu undoes exactly one step", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-6", 6);
  await page.keyboard.type("ab");
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  await page.keyboard.type("cd");
  await launched?.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.undo(),
  );
  await expectCursor(page, "Node 6a|b");
});

test("undo works without a focused node", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-6", 3);
  await page.keyboard.press("Tab");
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press(UNDO);
  await expectOutline(page, SEED);
  await expectCursor(page, "Nod|e 6");
});

test("the first empty node cannot be undone", async () => {
  const page = await launch(0);
  await page.locator(".cm-content").click();
  await page.keyboard.type("x");
  await page.keyboard.press(UNDO);
  await expectCursor(page, "|");
  await page.keyboard.press(UNDO);
  await page.keyboard.type("y");
  await expectCursor(page, "y|");
});

test("the rows above do not move while editing", async () => {
  const page = await launch(5000);
  await scrollTo(page, 3000);
  await expect(page.locator('[data-node-id="seed-1"]')).toHaveCount(0);
  const ids = await page
    .locator("[data-node-id]")
    .evaluateAll((rows) =>
      rows
        .filter((row) => row.getBoundingClientRect().top > 300)
        .map((row) => row.getAttribute("data-node-id") as string),
    );
  const [above, edited] = ids;
  const top = () =>
    page
      .locator(`[data-node-id="${above}"]`)
      .evaluate((row) => row.getBoundingClientRect().top);
  await putCursor(page, edited, 2);
  const before = await top();
  for (const key of [
    "Enter",
    "Backspace",
    "Enter",
    "Tab",
    "Shift+Tab",
    UNDO,
    UNDO,
    UNDO,
    REDO,
    UNDO,
  ]) {
    await page.keyboard.press(key);
    await settle(page);
    expect(await top()).toBeCloseTo(before, 0);
  }
});

test("the node with the cursor keeps the focus when it is scrolled away", async () => {
  const page = await launch(5000);
  await putCursor(page, "seed-4", 3);
  const row = page.locator('[data-node-id="seed-4"]');
  await scrollTo(page, 60_000);
  await expect(page.locator('[data-node-id="seed-1"]')).toHaveCount(0);
  await expect(row).toHaveCount(1);
  await expectCursor(page, "Nod|e 4");

  // The rendered rows are not contiguous now.
  const position = await page.getByTestId("outline").evaluate((outline) => {
    const { top, bottom } = outline.getBoundingClientRect();
    const boxes = [...outline.querySelectorAll("[data-node-id]")]
      .slice(1)
      .map((element) => element.getBoundingClientRect());
    return {
      first: boxes[0].top - top,
      last: boxes[boxes.length - 1].bottom - bottom,
    };
  });
  expect(position.first).toBeLessThanOrEqual(0);
  expect(position.last).toBeGreaterThanOrEqual(0);

  await scrollTo(page, 0);
  await expect(page.locator('[data-node-id="seed-1"]')).toBeVisible();
  await expectCursor(page, "Nod|e 4");
  await page.keyboard.type("x");
  await expectCursor(page, "Nodx|e 4");
});

test("a node below the visible rows keeps the focus", async () => {
  const page = await launch(5000);
  await scrollTo(page, 60_000);
  await expect(page.locator('[data-node-id="seed-1"]')).toHaveCount(0);
  const id = (await page
    .locator("[data-node-id]")
    .nth(20)
    .getAttribute("data-node-id")) as string;
  await putCursor(page, id, 2);
  const cursor = (await cursorText(page)) as string;
  await scrollTo(page, 0);
  await expect(page.locator('[data-node-id="seed-1"]')).toBeVisible();
  await expectCursor(page, cursor);
});

test("undo scrolls to a node that is not rendered", async () => {
  const page = await launch(5000);
  await putCursor(page, "seed-4", 6);
  await page.keyboard.type(" edited");
  await page.keyboard.press("Enter");
  await scrollTo(page, 60_000);
  await expect(page.locator('[data-node-id="seed-1"]')).toHaveCount(0);
  const other = (await page
    .locator("[data-node-id]")
    .nth(20)
    .getAttribute("data-node-id")) as string;
  await putCursor(page, other, 0);
  await expect(page.locator('[data-node-id="seed-4"]')).toHaveCount(0);

  await page.keyboard.press(UNDO);
  await expectCursor(page, "Node 4 edited|");
  await expect(page.locator('[data-node-id="seed-4"]')).toBeInViewport();
  await page.keyboard.press(UNDO);
  await expectCursor(page, "Node 4|");

  await page.keyboard.press("ArrowDown");
  await expectCursor(page, "|Node 5");
});

test("undo of a collapse moves the cursor back into the subtree", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-3", 4);
  const row = page.locator('[data-node-id="seed-2"]');
  await row.getByRole("button", { name: "Show children" }).click();
  await expectCursor(page, "Node 2|");
  await page.keyboard.press(UNDO);
  await expectOutline(page, SEED);
  await expectCursor(page, "Node| 3");
  await page.keyboard.press(REDO);
  await expectCursor(page, "Node 2|");
});
