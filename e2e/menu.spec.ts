import { expect, test, type Page } from "@playwright/test";
import { clickMenuItem, launchApp, type LaunchedApp } from "./launch";
import { expectCursor, expectOutline, putCursor, settle } from "./outline-page";

const SEED = ["Node 1", "  Node 2", "    Node 3"];

let launched: LaunchedApp;
let page: Page;

test.beforeEach(async () => {
  launched = await launchApp({ DIAMIND_SEED_NODES: "3" });
  page = await launched.app.firstWindow();
  await expect(page.locator(".cm-content").first()).toBeVisible();
});

test.afterEach(async () => {
  await launched.close();
});

function menuState(id: string): Promise<boolean | undefined> {
  return launched.app.evaluate(
    ({ Menu }, itemId) =>
      Menu.getApplicationMenu()?.getMenuItemById(itemId)?.enabled,
    id,
  );
}

async function typeTwoSteps(): Promise<void> {
  await putCursor(page, "seed-3", 6);
  await page.keyboard.type("ab");
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  await page.keyboard.type("cd");
  await expectCursor(page, "Node 3acd|b");
}

test("Undo and Redo of the menu run exactly one step", async () => {
  await typeTwoSteps();
  await clickMenuItem(launched.app, "undo");
  await expectCursor(page, "Node 3a|b");
  await settle(page);
  await expectCursor(page, "Node 3a|b");
  await clickMenuItem(launched.app, "undo");
  await expectCursor(page, "Node 3|");
  await clickMenuItem(launched.app, "redo");
  await expectCursor(page, "Node 3ab|");
  await clickMenuItem(launched.app, "redo");
  await expectCursor(page, "Node 3acd|b");
});

test("Undo of the menu works without a focused editor", async () => {
  await putCursor(page, "seed-3", 2);
  await page.keyboard.press("Shift+Tab");
  await expectOutline(page, ["Node 1", "  Node 2", "  Node 3"]);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await clickMenuItem(launched.app, "undo");
  await expectOutline(page, SEED);
  await expectCursor(page, "No|de 3");
});

test("a text input keeps its own undo", async () => {
  await typeTwoSteps();
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "other";
    input.style.position = "fixed";
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.type("xy");
  await clickMenuItem(launched.app, "undo");
  await expect(page.locator("#other")).toHaveValue("");
  await clickMenuItem(launched.app, "redo");
  await expect(page.locator("#other")).toHaveValue("xy");
  await expect(page.locator('[data-node-id="seed-3"]')).toHaveText(
    "Node 3acdb",
  );
});

test("the key of Undo is handled by the renderer", async () => {
  await typeTwoSteps();
  await page.evaluate(() => {
    window.addEventListener("keydown", (event) => {
      document.title = String(event.defaultPrevented);
    });
  });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page).toHaveTitle("true");
  await expectCursor(page, "Node 3a|b");
});

test("the menu commands are disabled without a window", async () => {
  test.skip(process.platform !== "darwin", "Only macOS keeps the app running");
  expect(await menuState("undo")).toBe(true);
  const closed = page.waitForEvent("close");
  await launched.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].close();
  });
  await closed;
  await expect.poll(() => menuState("undo")).toBe(false);

  const reopened = launched.app.waitForEvent("window");
  await launched.app.evaluate(({ app }) => {
    app.emit("activate");
  });
  await reopened;
  expect(await menuState("undo")).toBe(true);
});
