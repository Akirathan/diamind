import { expect, test, type Page } from "@playwright/test";
import { parseOutlineJson, type DiamindApi } from "@/shared/api";
import type { Node } from "@/shared/outline/node";
import { launchApp, type LaunchedApp } from "./launch";

/** Longer than the delay of the write queue. */
const SAVE_WAIT_MS = 1000;

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

function savedNodes(page: Page): Promise<Node[]> {
  return page
    .evaluate(() =>
      (window as unknown as { diamind: DiamindApi }).diamind.loadOutline(),
    )
    .then((json) => parseOutlineJson(json).nodes);
}

async function savedTexts(page: Page): Promise<string[]> {
  return (await savedNodes(page)).map((node) => node.text);
}

async function savedRootId(page: Page): Promise<string> {
  const roots = (await savedNodes(page)).filter(
    (node) => node.parentId === null,
  );
  expect(roots).toHaveLength(1);
  return roots[0].id;
}

async function type(page: Page, text: string): Promise<void> {
  await page.locator(".cm-content").first().click();
  await page.keyboard.type(text);
}

async function expectTexts(page: Page, texts: string[]): Promise<void> {
  await expect(page.locator(".cm-content")).toHaveText(texts);
}

test("typed text is there after a restart", async () => {
  launched = await launchApp();
  const page = await launched.app.firstWindow();
  await type(page, "Hello DiaMind");
  await expect(async () => {
    expect(await savedTexts(page)).toContain("Hello DiaMind");
  }).toPass();

  await launched.restart();
  await expectTexts(await launched.app.firstWindow(), ["Hello DiaMind"]);
});

test("text typed right before the quit is saved", async () => {
  launched = await launchApp();
  const page = await launched.app.firstWindow();
  await expect(page.locator(".cm-content")).toHaveCount(1);
  await page.waitForTimeout(SAVE_WAIT_MS);
  await type(page, "last words");
  await launched.restart();
  await expectTexts(await launched.app.firstWindow(), ["last words"]);
});

test("the root id does not change across restarts", async () => {
  launched = await launchApp();
  let page = await launched.app.firstWindow();
  await expect(page.locator(".cm-content")).toHaveCount(1);
  await page.waitForTimeout(SAVE_WAIT_MS);
  const rootId = await savedRootId(page);

  for (let i = 0; i < 2; i++) {
    await launched.restart();
    page = await launched.app.firstWindow();
    await expectTexts(page, [""]);
    await page.waitForTimeout(SAVE_WAIT_MS);
    expect(await savedRootId(page)).toBe(rootId);
    expect(await savedNodes(page)).toHaveLength(2);
  }
});

test("the changes are saved when the window loses the focus", async () => {
  launched = await launchApp();
  const page = await launched.app.firstWindow();
  await type(page, "x");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
  });
  expect(await savedTexts(page)).toContain("x");
});

test("a page reload keeps the last changes", async () => {
  launched = await launchApp();
  const page = await launched.app.firstWindow();
  await type(page, "before reload");
  await page.reload();
  await expectTexts(page, ["before reload"]);
});

test("closing the window saves, reopening it loads", async () => {
  test.skip(process.platform !== "darwin", "Only macOS keeps the app running");
  launched = await launchApp();
  const { app } = launched;
  const page = await app.firstWindow();
  await type(page, "before close");
  const closed = page.waitForEvent("close");
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].close();
  });
  await closed;

  const reopened = app.waitForEvent("window");
  await app.evaluate(({ app }) => {
    app.emit("activate");
  });
  const secondPage = await reopened;
  await expectTexts(secondPage, ["before close"]);

  await type(secondPage, "first, ");
  await launched.restart();
  await expect(
    (await launched.app.firstWindow()).locator(".cm-content"),
  ).toContainText("first, ");
});

test("a hung renderer does not block the quit forever", async () => {
  launched = await launchApp();
  const page = await launched.app.firstWindow();
  await type(page, "saved");
  await expect(async () => {
    expect(await savedTexts(page)).toContain("saved");
  }).toPass();
  await page.evaluate(() => {
    setTimeout(() => {
      for (;;) {}
    });
  });

  await launched.restart();
  await expectTexts(await launched.app.firstWindow(), ["saved"]);
});

test("a seeded session does not change the saved outline", async () => {
  launched = await launchApp();
  await type(await launched.app.firstWindow(), "mine");
  await launched.restart({ DIAMIND_SEED_NODES: "20" });
  const seeded = await launched.app.firstWindow();
  await expect(seeded.getByText("Node 1", { exact: true })).toBeVisible();
  await type(seeded, "not saved ");
  await seeded.waitForTimeout(SAVE_WAIT_MS);
  expect(await savedTexts(seeded)).toEqual(["", "mine"]);

  await launched.restart({ DIAMIND_SEED_NODES: "0" });
  await expectTexts(await launched.app.firstWindow(), ["mine"]);
});
