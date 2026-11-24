import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseOutlineJson, type DiamindApi } from "@/shared/api";
import { launchApp, type LaunchedApp } from "./launch";

let launched: LaunchedApp;

test.beforeEach(async () => {
  launched = await launchApp();
});

test.afterEach(async () => {
  await launched.close();
});

test("opens one main window", async () => {
  const window = await launched.app.firstWindow();
  await expect(window).toHaveTitle("DiaMind");
  await expect(window.getByTestId("outline")).toBeVisible();
  expect(launched.app.windows()).toHaveLength(1);
});

test("renderer gets app info from the main process", async () => {
  const page = await launched.app.firstWindow();
  const info = await page.evaluate(() =>
    (window as unknown as { diamind: DiamindApi }).diamind.getAppInfo(),
  );
  expect(info.dataDir).toBe(launched.dataDir);
  expect(info.devSeedNodeCount).toBe(0);
});

test("renderer has no Node.js access", async () => {
  const window = await launched.app.firstWindow();
  expect(await window.evaluate(() => typeof require)).toBe("undefined");
  expect(await window.evaluate(() => typeof process)).toBe("undefined");
});

test("creates the database with the global root and one empty node", async () => {
  const page = await launched.app.firstWindow();
  await expect(async () => {
    const outline = await page.evaluate(() =>
      (window as unknown as { diamind: DiamindApi }).diamind.loadOutline(),
    );
    const { nodes, uiState } = parseOutlineJson(outline);
    expect(nodes).toHaveLength(2);
    const root = nodes.find((node) => node.parentId === null);
    const child = nodes.find((node) => node.parentId === root?.id);
    expect(child).toMatchObject({ text: "", note: "" });
    expect(uiState).toEqual([]);
  }).toPass();
  expect(existsSync(join(launched.dataDir, "diamind.db"))).toBe(true);
});
