import { expect, test, type Locator, type Page } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./launch";

// Depths of the seed nodes 1 .. 15: 0 1 2 2 1, repeated. Node 13 wraps to more lines.
const SEED_NODES = "15";

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

async function launchSeeded(): Promise<Page> {
  launched = await launchApp({ DIAMIND_SEED_NODES: SEED_NODES });
  const window = await launched.app.firstWindow();
  await expect(row(window, 1)).toBeVisible();
  return window;
}

function row(window: Page, n: number): Locator {
  return window.locator(`[data-node-id="seed-${n}"]`);
}

function arrow(window: Page, n: number): Locator {
  return row(window, n).getByRole("button", { name: "Show children" });
}

function editor(window: Page, n: number): Locator {
  return row(window, n).locator(".cm-content");
}

function visibleIds(window: Page): Promise<string[]> {
  return window
    .locator("[data-node-id]")
    .evaluateAll((rows) =>
      rows.map((element) =>
        (element.getAttribute("data-node-id") as string).replace("seed-", ""),
      ),
    );
}

/** The current indent line as `<node>:<level>` of its segments. */
function currentLine(window: Page): Promise<string[]> {
  return window
    .locator('[data-testid="indent-line"][data-current="true"]')
    .evaluateAll((lines) =>
      lines.map((line) => {
        const id = line.closest("[data-node-id]")?.getAttribute("data-node-id");
        return `${id?.replace("seed-", "")}:${line.getAttribute("data-level")}`;
      }),
    );
}

test("only nodes with children have an arrow", async () => {
  const window = await launchSeeded();
  for (const n of [1, 2, 6, 7, 11, 12]) {
    await expect(arrow(window, n)).toHaveAttribute("aria-expanded", "true");
  }
  await expect(
    window.getByRole("button", { name: "Show children" }),
  ).toHaveCount(6);
});

test("the arrow collapses and expands the children", async () => {
  const window = await launchSeeded();
  await arrow(window, 2).click();
  await expect(arrow(window, 2)).toHaveAttribute("aria-expanded", "false");
  await expect(row(window, 3)).toHaveCount(0);
  await expect(row(window, 4)).toHaveCount(0);
  await expect(row(window, 5)).toBeVisible();
  const bullet = row(window, 2).getByTestId("bullet");
  await expect(bullet).not.toHaveCSS("box-shadow", "none");

  await arrow(window, 1).click();
  await expect(row(window, 2)).toHaveCount(0);

  // The inner node stays collapsed.
  await arrow(window, 1).click();
  await expect(row(window, 2)).toBeVisible();
  expect((await visibleIds(window)).slice(0, 4)).toEqual(["1", "2", "5", "6"]);

  await arrow(window, 2).click();
  await expect(row(window, 4)).toBeVisible();
  expect((await visibleIds(window)).slice(0, 5)).toEqual([
    "1",
    "2",
    "3",
    "4",
    "5",
  ]);
});

test("the current indent line follows the cursor", async () => {
  const window = await launchSeeded();
  await expect(window.getByTestId("indent-line")).not.toHaveCount(0);
  expect(await currentLine(window)).toEqual([]);

  await editor(window, 3).click();
  await expect.poll(() => currentLine(window)).toEqual(["3:1", "4:1"]);
  await editor(window, 5).click();
  await expect
    .poll(() => currentLine(window))
    .toEqual(["2:0", "3:0", "4:0", "5:0"]);
  await editor(window, 1).click();
  await expect.poll(() => currentLine(window)).toEqual([]);
});

test("a collapse keeps the cursor in an unrelated node", async () => {
  const window = await launchSeeded();
  await editor(window, 5).click();
  await arrow(window, 2).click();
  await expect(row(window, 3)).toHaveCount(0);
  await expect(editor(window, 5)).toBeFocused();
  expect(await currentLine(window)).toEqual(["2:0", "5:0"]);
});

test("the cursor moves out of a subtree that collapses", async () => {
  const window = await launchSeeded();
  await editor(window, 3).click();
  await arrow(window, 2).click();
  await expect(row(window, 3)).toHaveCount(0);
  await expect(editor(window, 2)).toBeFocused();
  expect(await currentLine(window)).toEqual(["2:0", "5:0"]);
  await window.keyboard.type("!");
  await expect(editor(window, 2)).toHaveText("Node 2!");
});

test("indent lines are continuous and aligned with the bullets", async () => {
  const window = await launchSeeded();
  await window.setViewportSize({ width: 600, height: 800 });
  await expect
    .poll(async () => (await row(window, 13).boundingBox())?.height)
    .toBeGreaterThan(40);

  const rows = await window.locator("[data-node-id]").evaluateAll((elements) =>
    elements.map((element) => {
      const bullet = element.querySelector('[data-testid="bullet"]') as Element;
      const bulletBox = bullet.getBoundingClientRect();
      const lines = [
        ...element.querySelectorAll('[data-testid="indent-line"]'),
      ].map((line) => {
        const box = line.getBoundingClientRect();
        return { x: box.left, top: box.top, bottom: box.bottom };
      });
      return { bulletX: bulletBox.left + bulletBox.width / 2, lines };
    }),
  );
  expect(rows.map(({ lines }) => lines.length)).toEqual([
    0, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0, 1, 2, 2, 1,
  ]);
  const bulletX: number[] = [];
  rows.forEach(({ bulletX: x, lines }, index) => {
    bulletX[lines.length] = x;
    lines.forEach((line, level) => {
      expect(Math.abs(line.x - bulletX[level])).toBeLessThanOrEqual(1);
      const above = rows[index - 1].lines[level];
      if (above !== undefined) {
        expect(Math.abs(line.top - above.bottom)).toBeLessThanOrEqual(0.1);
      }
    });
  });
});
