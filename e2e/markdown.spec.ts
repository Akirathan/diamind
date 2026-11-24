import { expect, test, type Locator, type Page } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./launch";

type OpenedLinks = { opened: string[] };

let launched: LaunchedApp;
let page: Page;
let content: Locator;

test.beforeEach(async () => {
  launched = await launchApp();
  // Real links must not be opened by a test.
  await launched.app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as unknown as OpenedLinks).opened = opened;
    shell.openExternal = async (url) => {
      opened.push(`external ${url}`);
    };
    shell.openPath = async (path) => {
      opened.push(`path ${path}`);
      return "";
    };
  });
  page = await launched.app.firstWindow();
  content = page.locator(".cm-content");
  await content.click();
});

test.afterEach(async () => {
  await launched.close();
});

function openedLinks(): Promise<string[]> {
  return launched.app.evaluate(
    () => (globalThis as unknown as OpenedLinks).opened,
  );
}

async function blurEditor() {
  await content.evaluate((element) => (element as HTMLElement).blur());
}

async function clickBehindText() {
  const box = await content.boundingBox();
  if (box === null) {
    throw new Error("The editor is not visible");
  }
  await page.mouse.click(box.x + box.width - 20, box.y + box.height / 2);
}

test("markers of bold text are visible only with the cursor", async () => {
  await page.keyboard.type("a **bold** text");
  await expect(content).toHaveText("a bold text");
  const bold = content.getByText("bold", { exact: true });
  await expect(bold).toHaveCSS("font-weight", "700");

  for (let i = 0; i < " text".length; i++) {
    await page.keyboard.press("ArrowLeft");
  }
  await expect(content).toHaveText("a **bold** text");

  await blurEditor();
  await expect(content).toHaveText("a bold text");
  await content.focus();
  await expect(content).toHaveText("a **bold** text");
});

test("a click in bold text shows the markers and selects nothing", async () => {
  await page.keyboard.type("**bold** text");
  await blurEditor();
  await expect(content).toHaveText("bold text");
  const box = await content.getByText("bold", { exact: true }).boundingBox();
  if (box === null) {
    throw new Error("The bold text is not visible");
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 1, y);
  await page.mouse.up();
  await expect(content).toHaveText("**bold** text");
  await page.keyboard.type("X");
  await expect(content).toHaveText(/^\*\*b\w*X\w*d\*\* text$/);
  expect((await content.textContent())?.length).toBe("**boXld** text".length);
});

test("text typed behind bold text is not bold", async () => {
  await page.keyboard.type("some **bold**");
  await blurEditor();
  await expect(content).toHaveText("some bold");
  await clickBehindText();
  await page.keyboard.type(" text");
  await expect(content).toHaveText("some bold text");
  await blurEditor();
  await expect(content.getByText("bold", { exact: true })).toBeVisible();
});

test("block syntax stays plain text", async () => {
  await page.keyboard.type("# - 1. **bold**");
  await blurEditor();
  await expect(content).toHaveText("# - 1. bold");
});

test("the row height is the same with inline code", async () => {
  const line = content.locator(".cm-line");
  await page.keyboard.type("text");
  const height = (await line.boundingBox())?.height;
  await page.keyboard.type(" `code`");
  await blurEditor();
  await expect(content).toHaveText("text code");
  expect((await line.boundingBox())?.height).toBe(height);
});

test("Cmd + click on a link opens it", async () => {
  await page.keyboard.type(
    "[docs](https://example.com/a) file:///Users/some%20dir http://b.c end",
  );
  const shown = "docs file:///Users/some%20dir http://b.c end";
  await expect(content).toHaveText(shown);
  const url = page.url();
  const links = content.locator("[data-link-url]");
  await expect(links).toHaveCount(3);
  await links.nth(0).click({ modifiers: ["ControlOrMeta"] });
  await expect.poll(openedLinks).toEqual(["external https://example.com/a"]);
  await links.nth(1).click({ modifiers: ["ControlOrMeta"] });
  await links.nth(2).click({ modifiers: ["ControlOrMeta"] });
  await expect
    .poll(openedLinks)
    .toEqual([
      "external https://example.com/a",
      "path /Users/some dir",
      "external http://b.c/",
    ]);
  expect(page.url()).toBe(url);
  expect(launched.app.windows()).toHaveLength(1);
  // The cursor did not move into a link.
  await expect(content).toHaveText(shown);
});

test("a plain click on a link moves the cursor into it", async () => {
  await page.keyboard.type("[docs](https://example.com) end");
  await blurEditor();
  await expect(content).toHaveText("docs end");
  await content.locator("[data-link-url]").click();
  await expect(content).toHaveText("[docs](https://example.com) end");
  await page.keyboard.type("X");
  await expect(content).toHaveText(/^\[d\w*X\w*s\]/);

  await content.locator("[data-link-url]").click({
    modifiers: ["ControlOrMeta"],
  });
  await expect.poll(openedLinks).toEqual(["external https://example.com/"]);
});

test("an invalid link looks like a valid one and does not open", async () => {
  await page.keyboard.type("[one](www.example.com) [two]() end");
  await expect(content).toHaveText("one two end");
  const links = content.locator("[data-link-url]");
  await expect(links).toHaveCount(2);
  const failed = page.waitForEvent("console", (message) =>
    message.text().includes("Cannot open www.example.com"),
  );
  await links.nth(0).click({ modifiers: ["ControlOrMeta"] });
  await failed;
  await links.nth(1).click({ modifiers: ["ControlOrMeta"] });
  await expect(content).toHaveText("one two end");
  expect(await openedLinks()).toEqual([]);

  await links.nth(0).click();
  await expect(content).toHaveText("[one](www.example.com) two end");
});

test("the mouse cursor over a link is a pointer only with Cmd", async () => {
  await page.keyboard.type("[docs](https://example.com) end");
  const link = content.locator("[data-link-url]");
  await link.hover();
  await expect(link).toHaveCSS("cursor", "auto");
  await page.keyboard.down("ControlOrMeta");
  await expect(link).toHaveCSS("cursor", "pointer");
  await page.keyboard.up("ControlOrMeta");
  await expect(link).toHaveCSS("cursor", "auto");
});

test("the backslash of an escape is visible and dimmed", async () => {
  await page.keyboard.type("\\*a*");
  await blurEditor();
  await expect(content).toHaveText("\\*a*");
  await expect(content.getByText("\\", { exact: true })).toHaveClass(
    /text-neutral-400/,
  );
});

test("the main process rejects other protocols", async () => {
  const outcomes = await page.evaluate(async () => {
    const { diamind } = window as unknown as {
      diamind: { openLink(url: string): Promise<void> };
    };
    const results: string[] = [];
    for (const url of ["javascript:alert(1)", "vscode://file/x", "/Users"]) {
      results.push(
        await diamind.openLink(url).then(
          () => "opened",
          () => "rejected",
        ),
      );
    }
    return results;
  });
  expect(outcomes).toEqual(["rejected", "rejected", "rejected"]);
  expect(await openedLinks()).toEqual([]);
});
