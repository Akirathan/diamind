import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
} from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let app: ElectronApplication;
let dataDir: string;

test.beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "diamind-e2e-"));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "ELECTRON_RENDERER_URL") {
      env[key] = value;
    }
  }
  env.DIAMIND_DATA_DIR = dataDir;
  app = await electron.launch({ args: ["."], env });
});

test.afterEach(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test("opens one main window", async () => {
  const window = await app.firstWindow();
  await expect(window).toHaveTitle("DiaMind");
  await expect(window.getByRole("heading", { name: "DiaMind" })).toBeVisible();
  expect(app.windows()).toHaveLength(1);
});

test("renderer gets app info from the main process", async () => {
  const window = await app.firstWindow();
  await expect(window.getByText(`data: ${dataDir}`)).toBeVisible();
});

test("renderer has no Node.js access", async () => {
  const window = await app.firstWindow();
  expect(await window.evaluate(() => typeof require)).toBe("undefined");
  expect(await window.evaluate(() => typeof process)).toBe("undefined");
});
