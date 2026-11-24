import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseOutlineJson, type DiamindApi } from "@/shared/api";
import { clickMenuItem, launchApp, type LaunchedApp } from "./launch";
import { expectCursor, expectOutline, settle } from "./outline-page";

const OPML = `<?xml version="1.0"?>
<opml version="2.0">
  <head><ownerEmail>a@example.com</ownerEmail></head>
  <body>
    <outline text="Project" _note="Note &lt;b&gt;bold&lt;/b&gt;&#10;second">
      <outline _complete="true" text="Done" />
      <outline text="" />
      <outline text="" />
    </outline>
    <outline text="a &amp;amp; &lt;b&gt;bold&lt;/b&gt;" />
  </body>
</opml>`;

let launched: LaunchedApp;
let page: Page;

test.beforeEach(async () => {
  launched = await launchApp();
  page = await launched.app.firstWindow();
  await page.locator(".cm-content").click();
  await page.keyboard.type("mine");
});

test.afterEach(async () => {
  await launched.close();
});

interface DialogCalls {
  opened: number;
  errors: unknown[];
}

/** Imports a file with this content. */
async function importFile(content: string): Promise<void> {
  const path = join(launched.dataDir, "export.opml");
  writeFileSync(path, content);
  await stubDialogs([path]);
  await clickMenuItem(launched.app, "importWorkflowy");
}

/** No path cancels the dialog. */
function stubDialogs(filePaths: string[]): Promise<void> {
  return launched.app.evaluate(({ dialog }, paths) => {
    const calls: DialogCalls = { opened: 0, errors: [] };
    (globalThis as { dialogCalls?: DialogCalls }).dialogCalls = calls;
    dialog.showOpenDialog = () => {
      calls.opened++;
      return Promise.resolve({
        canceled: paths.length === 0,
        filePaths: paths,
      });
    };
    dialog.showMessageBox = (...args: unknown[]) => {
      calls.errors.push(args[args.length - 1]);
      return Promise.resolve({ response: 0, checkboxChecked: false });
    };
  }, filePaths);
}

function dialogCalls(): Promise<DialogCalls | undefined> {
  return launched.app.evaluate(
    () => (globalThis as { dialogCalls?: DialogCalls }).dialogCalls,
  );
}

async function importErrors(): Promise<unknown[]> {
  return (await dialogCalls())?.errors ?? [];
}

const IMPORTED = ["mine", "Project", "  Done", "  ", "  ", "a & bold"];

test("imports a file as one undo step", async () => {
  await importFile(OPML);
  await expectOutline(page, IMPORTED);
  await expectCursor(page, "|Project");
  await page.keyboard.press("ControlOrMeta+z");
  await expectOutline(page, ["mine"]);
  await expectCursor(page, "mine|");
  await clickMenuItem(launched.app, "redo");
  await expectOutline(page, IMPORTED);
  await page.keyboard.type("The ");
  await expectCursor(page, "The |Project");
});

test("a restart keeps the imported nodes", async () => {
  await importFile(OPML);
  await expectOutline(page, IMPORTED);
  await launched.restart();
  page = await launched.app.firstWindow();
  await expectOutline(page, IMPORTED);

  const json = await page.evaluate(() =>
    (window as unknown as { diamind: DiamindApi }).diamind.loadOutline(),
  );
  const { nodes } = parseOutlineJson(json);
  expect(nodes.find((node) => node.text === "Project")).toMatchObject({
    note: "Note **bold**\nsecond",
    completedAt: null,
  });
  expect(nodes.find((node) => node.text === "a & **bold**")).toBeDefined();
  const done = nodes.find((node) => node.text === "Done");
  expect(done?.completedAt).toBeGreaterThan(0);
  expect(done?.completedAt).toBe(done?.createdAt);
});

test("a malformed file shows an error and changes nothing", async () => {
  await importFile(OPML.slice(0, -30));
  await expect.poll(importErrors).toEqual([
    expect.objectContaining({
      type: "error",
      detail: expect.stringContaining("malformed"),
    }),
  ]);
  await expectOutline(page, ["mine"]);
  await page.keyboard.press("ControlOrMeta+z");
  await expectOutline(page, [""]);

  await importFile(OPML);
  await expectOutline(page, ["", ...IMPORTED.slice(1)]);
});

test("a canceled dialog changes nothing", async () => {
  await stubDialogs([]);
  await clickMenuItem(launched.app, "importWorkflowy");
  await expect.poll(async () => (await dialogCalls())?.opened).toBe(1);
  await settle(page);
  await expectOutline(page, ["mine"]);
  expect(await importErrors()).toEqual([]);

  await importFile(OPML);
  await expectOutline(page, IMPORTED);
});

test("imports a large file", async () => {
  const outlines = Array.from(
    { length: 20_000 },
    (_, i) => `<outline text="Node &lt;b&gt;${i}&lt;/b&gt;"/>`,
  );
  await importFile(`<opml><body>${outlines.join("")}</body></opml>`);
  await expectCursor(page, "|Node 0");
  await page.keyboard.press("ControlOrMeta+z");
  await expectOutline(page, ["mine"]);
});
