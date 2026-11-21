import { expect, test } from "@playwright/test";
import type { DiamindApi } from "../src/shared/api";
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
