import { expect, test, type Locator, type Page } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./launch";
import { expectCursor, putCursor, scrollTo, settle } from "./outline-page";

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

function row(page: Page, nodeId: string): Locator {
  return page.locator(`[data-node-id="${nodeId}"]`);
}

function note(page: Page, nodeId: string): Locator {
  return row(page, nodeId).locator('[data-node-field="note"]');
}

function noteLines(page: Page, nodeId: string): Promise<string[]> {
  return note(page, nodeId).locator(".cm-line").allTextContents();
}

async function expectNote(
  page: Page,
  nodeId: string,
  lines: string[],
): Promise<void> {
  await expect.poll(() => noteLines(page, nodeId)).toEqual(lines);
}

/** Types a note, also over several lines, and leaves the cursor in it. */
async function addNote(
  page: Page,
  nodeId: string,
  text: string,
): Promise<void> {
  await putCursor(page, nodeId, 0);
  await page.keyboard.press("Shift+Enter");
  await expect(note(page, nodeId)).toBeVisible();
  await typeLines(page, text);
  await expectNote(page, nodeId, text.split("\n"));
}

async function typeLines(page: Page, text: string): Promise<void> {
  const [first, ...rest] = text.split("\n");
  await page.keyboard.type(first);
  for (const line of rest) {
    await page.keyboard.press("Enter");
    await page.keyboard.type(line);
  }
  await settle(page);
}

/** The focused field and its selection, as `<node id>:<field>:<line>:<column>`. */
function cursorPlace(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const content = document.activeElement;
    const selection = window.getSelection();
    const place = content?.closest("[data-node-field]");
    if (!content || !place || selection?.focusNode == null) {
      return null;
    }
    const lines = [...content.querySelectorAll(".cm-line")];
    const line = lines.findIndex((l) => l.contains(selection.focusNode));
    const range = document.createRange();
    range.setStart(lines[line], 0);
    range.setEnd(selection.focusNode, selection.focusOffset);
    const id = place.closest("[data-node-id]")?.getAttribute("data-node-id");
    const field = place.getAttribute("data-node-field");
    return `${id}:${field}:${line}:${range.toString().length}`;
  });
}

async function expectPlace(page: Page, place: string): Promise<void> {
  await expect.poll(() => cursorPlace(page)).toBe(place);
  await settle(page);
}

async function pressAndExpect(
  page: Page,
  key: string,
  place: string,
): Promise<void> {
  await page.keyboard.press(key);
  await expectPlace(page, place);
}

test("Shift + Enter creates a note and toggles between text and note", async () => {
  const page = await launch(2);
  await expect(page.locator('[data-node-field="note"]')).toHaveCount(0);
  await putCursor(page, "seed-1", 2);
  await pressAndExpect(page, "Shift+Enter", "seed-1:note:0:0");
  await page.keyboard.type("a note");
  await pressAndExpect(page, "Shift+Enter", "seed-1:text:0:6");
  await expectNote(page, "seed-1", ["a note"]);
  await pressAndExpect(page, "ArrowLeft", "seed-1:text:0:5");
  await pressAndExpect(page, "Shift+Enter", "seed-1:note:0:6");
  await expect(note(page, "seed-2")).toHaveCount(0);
});

test("Enter in a note inserts a line break", async () => {
  const page = await launch(2);
  await addNote(page, "seed-1", "one\ntwo");
  await pressAndExpect(page, "ArrowLeft", "seed-1:note:1:2");
  await pressAndExpect(page, "Enter", "seed-1:note:2:0");
  await expectNote(page, "seed-1", ["one", "tw", "o"]);
  await pressAndExpect(page, "Enter", "seed-1:note:3:0");
  await expectNote(page, "seed-1", ["one", "tw", "", "o"]);
  await expect(page.locator("[data-node-id]")).toHaveCount(2);
});

test("a note is smaller, grey and aligned with the text", async () => {
  const page = await launch(2);
  await addNote(page, "seed-1", "long ".repeat(100).trim());
  const styles = await row(page, "seed-1")
    .locator(".cm-content")
    .evaluateAll((contents) =>
      contents.map((content) => {
        const { fontSize, color } = getComputedStyle(content);
        const { left, top, bottom } = content.getBoundingClientRect();
        return { fontSize: parseFloat(fontSize), color, left, top, bottom };
      }),
    );
  const [text, noteStyle] = styles;
  expect(noteStyle.fontSize).toBeLessThan(text.fontSize);
  expect(noteStyle.color).not.toBe(text.color);
  expect(noteStyle.left).toBe(text.left);
  expect(noteStyle.top).toBeGreaterThanOrEqual(text.bottom);
  expect(noteStyle.bottom - noteStyle.top).toBeGreaterThan(30);
});

test("Up and Down move through text, note and neighbor nodes as lines", async () => {
  const page = await launch(3);
  await addNote(page, "seed-2", "one\ntwo");
  await addNote(page, "seed-3", "last");
  await putCursor(page, "seed-1", 3);
  await pressAndExpect(page, "ArrowDown", "seed-2:text:0:0");
  await pressAndExpect(page, "ArrowDown", "seed-2:note:0:0");
  await pressAndExpect(page, "ArrowDown", "seed-2:note:1:0");
  await pressAndExpect(page, "ArrowDown", "seed-3:text:0:0");
  await pressAndExpect(page, "ArrowDown", "seed-3:note:0:0");
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect(await cursorPlace(page)).toContain("seed-3:note:0:");

  await pressAndExpect(page, "ArrowUp", "seed-3:text:0:0");
  await pressAndExpect(page, "ArrowUp", "seed-2:note:1:0");
  await pressAndExpect(page, "ArrowUp", "seed-2:note:0:0");
  await pressAndExpect(page, "ArrowUp", "seed-2:text:0:0");
  await pressAndExpect(page, "ArrowUp", "seed-1:text:0:0");
});

test("Up from a note goes to the last visual line of the wrapped text", async () => {
  const page = await launch(14);
  await page.setViewportSize({ width: 600, height: 800 });
  await addNote(page, "seed-13", "note ".repeat(60).trim());
  // Of the character behind the cursor: at a wrap, the cursor has two places.
  const caretTop = () =>
    page.evaluate(() => {
      const range = window.getSelection()?.getRangeAt(0).cloneRange();
      range?.setEnd(range.startContainer, range.startOffset + 1);
      return range?.getBoundingClientRect().top;
    });
  const lastLineTop = (field: string) =>
    row(page, "seed-13")
      .locator(`[data-node-field="${field}"] .cm-line`)
      .evaluate((line) => {
        const range = document.createRange();
        range.selectNodeContents(line);
        return Math.max(...[...range.getClientRects()].map((r) => r.top));
      });

  await putCursor(page, "seed-14", 0);
  await page.keyboard.press("ArrowUp");
  await settle(page);
  expect(await cursorPlace(page)).toMatch(/^seed-13:note:0:[1-9]/);
  expect(await caretTop()).toBeCloseTo(await lastLineTop("note"), 0);

  let place: string | null;
  do {
    await page.keyboard.press("ArrowUp");
    await settle(page);
    place = await cursorPlace(page);
  } while (place?.startsWith("seed-13:note"));
  expect(place).toMatch(/^seed-13:text:0:[1-9]/);
  expect(await caretTop()).toBeCloseTo(await lastLineTop("text"), 0);
});

test("Tab and Shift + Tab in a note indent and unindent the node", async () => {
  const page = await launch(6);
  await addNote(page, "seed-6", "note");
  const left = () =>
    note(page, "seed-6").evaluate((el) => el.getBoundingClientRect().left);
  const before = await left();
  await pressAndExpect(page, "Tab", "seed-6:note:0:4");
  expect(await left()).toBe(before + 24);
  await pressAndExpect(page, "Shift+Tab", "seed-6:note:0:4");
  expect(await left()).toBe(before);
  await expectNote(page, "seed-6", ["note"]);
});

test("Tab in an empty note keeps it open", async () => {
  const page = await launch(6);
  await putCursor(page, "seed-6", 0);
  await pressAndExpect(page, "Shift+Enter", "seed-6:note:0:0");
  await pressAndExpect(page, "Tab", "seed-6:note:0:0");
  await page.keyboard.type("x");
  await expectNote(page, "seed-6", ["x"]);
});

test("Backspace at the beginning of a note changes nothing", async () => {
  const page = await launch(2);
  await addNote(page, "seed-2", "ab");
  await pressAndExpect(page, "ArrowLeft", "seed-2:note:0:1");
  await pressAndExpect(page, "Backspace", "seed-2:note:0:0");
  await expectNote(page, "seed-2", ["b"]);
  await pressAndExpect(page, "Backspace", "seed-2:note:0:0");
  await expectNote(page, "seed-2", ["b"]);
  await expect(page.locator("[data-node-id]")).toHaveCount(2);
});

test("Backspace in an empty note goes back to the text", async () => {
  const page = await launch(2);
  await addNote(page, "seed-2", "a");
  await pressAndExpect(page, "Backspace", "seed-2:note:0:0");
  await expectNote(page, "seed-2", [""]);
  await pressAndExpect(page, "Backspace", "seed-2:text:0:6");
  await expect(note(page, "seed-2")).toHaveCount(0);
});

test("an empty note disappears when it loses the focus", async () => {
  const page = await launch(3);
  await putCursor(page, "seed-2", 0);
  await pressAndExpect(page, "Shift+Enter", "seed-2:note:0:0");
  await row(page, "seed-3").locator(".cm-line").click();
  await expect(note(page, "seed-2")).toHaveCount(0);

  await addNote(page, "seed-2", "a");
  await page.keyboard.press("Backspace");
  await pressAndExpect(page, "ArrowDown", "seed-3:text:0:0");
  await expect(note(page, "seed-2")).toHaveCount(0);

  await putCursor(page, "seed-2", 0);
  await pressAndExpect(page, "Shift+Enter", "seed-2:note:0:0");
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await expect(note(page, "seed-2")).toHaveCount(0);
});

test("a note with text stays when it loses the focus", async () => {
  const page = await launch(3);
  await addNote(page, "seed-2", "a");
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await settle(page);
  await expectNote(page, "seed-2", ["a"]);
  await note(page, "seed-2").click();
  await expectPlace(page, "seed-2:note:0:1");
});

test("Backspace merge appends the note with a line break", async () => {
  const page = await launch(3);
  await addNote(page, "seed-2", "upper");
  await addNote(page, "seed-3", "lower 1\nlower 2");
  await putCursor(page, "seed-3", 0);
  await page.keyboard.press("Backspace");
  await expectCursor(page, "Node 2|Node 3");
  await expectPlace(page, "seed-2:text:0:6");
  await expectNote(page, "seed-2", ["upper", "lower 1", "lower 2"]);
  await page.keyboard.press(UNDO);
  await expectPlace(page, "seed-3:text:0:0");
  await expectNote(page, "seed-2", ["upper"]);
  await expectNote(page, "seed-3", ["lower 1", "lower 2"]);
});

test("a split leaves the note at the original node", async () => {
  const page = await launch(1);
  await addNote(page, "seed-1", "note");
  await putCursor(page, "seed-1", 2);
  await page.keyboard.press("Enter");
  await expectCursor(page, "|de 1");
  await expectNote(page, "seed-1", ["note"]);
  await expect(page.locator('[data-node-field="note"]')).toHaveCount(1);
});

test("Enter in a node with only a note creates a node below", async () => {
  const page = await launch(1);
  await addNote(page, "seed-1", "note");
  await pressAndExpect(page, "Shift+Enter", "seed-1:text:0:6");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expectCursor(page, "|");
  await page.keyboard.press("Enter");
  await page.keyboard.type("new");
  const rows = page.locator("[data-node-id]");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toHaveText("new");
  await expectNote(page, "seed-1", ["note"]);
});

test("a note takes pasted line breaks", async () => {
  const page = await launch(1);
  await addNote(page, "seed-1", "ab");
  await pressAndExpect(page, "ArrowLeft", "seed-1:note:0:1");
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "1\r\n\n2");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expectPlace(page, "seed-1:note:2:1");
  await expectNote(page, "seed-1", ["a1", "", "2b"]);
  await expect(page.locator("[data-node-id]")).toHaveCount(1);
});

test("undo and redo restore the cursor in the text or in the note", async () => {
  const page = await launch(2);
  await putCursor(page, "seed-1", 6);
  await page.keyboard.type("!");
  await pressAndExpect(page, "Shift+Enter", "seed-1:note:0:0");
  await page.keyboard.type("one");
  await page.keyboard.press("Enter");
  await page.keyboard.type("two");
  await pressAndExpect(page, "Shift+Enter", "seed-1:text:0:7");
  await page.keyboard.type("?");
  await expectPlace(page, "seed-1:text:0:8");

  await page.keyboard.press(UNDO);
  await expectPlace(page, "seed-1:text:0:7");
  await expectNote(page, "seed-1", ["one", "two"]);
  await page.keyboard.press(UNDO);
  await expectPlace(page, "seed-1:note:0:0");
  await expectNote(page, "seed-1", [""]);
  await page.keyboard.press(UNDO);
  await expectPlace(page, "seed-1:text:0:6");
  await expect(note(page, "seed-1")).toHaveCount(0);

  await page.keyboard.press(REDO);
  await expectPlace(page, "seed-1:text:0:7");
  await page.keyboard.press(REDO);
  await expectPlace(page, "seed-1:note:1:3");
  await expectNote(page, "seed-1", ["one", "two"]);
  await page.keyboard.press(REDO);
  await expectPlace(page, "seed-1:text:0:8");
});

test("undo scrolls to a note that is not rendered", async () => {
  const page = await launch(5000);
  await addNote(page, "seed-4", "a note");
  await scrollTo(page, 60_000);
  await expect(row(page, "seed-1")).toHaveCount(0);
  const other = (await page
    .locator("[data-node-id]")
    .nth(20)
    .getAttribute("data-node-id")) as string;
  await putCursor(page, other, 0);
  // The rendered rows follow the new current node at the next scroll.
  await scrollTo(page, 60_100);
  await expect(row(page, "seed-4")).toHaveCount(0);
  await page.keyboard.press(UNDO);
  await expectPlace(page, "seed-4:note:0:0");
  await page.keyboard.press(REDO);
  await expectPlace(page, "seed-4:note:0:6");
  await expect(note(page, "seed-4")).toBeInViewport();
});

test("a note with the cursor keeps the focus when it is scrolled away", async () => {
  const page = await launch(5000);
  await addNote(page, "seed-4", "note");
  await scrollTo(page, 60_000);
  await expect(row(page, "seed-1")).toHaveCount(0);
  await expectPlace(page, "seed-4:note:0:4");
  await scrollTo(page, 0);
  await page.keyboard.type("!");
  await expectNote(page, "seed-4", ["note!"]);
});

test("a note shows formatted markdown line by line", async () => {
  const page = await launch(1);
  await putCursor(page, "seed-1", 0);
  await pressAndExpect(page, "Shift+Enter", "seed-1:note:0:0");
  await typeLines(page, "**bold**\nplain");
  await expectNote(page, "seed-1", ["bold", "plain"]);
  await expect(note(page, "seed-1").locator(".font-bold")).toHaveText("bold");
  await pressAndExpect(page, "ArrowUp", "seed-1:note:0:8");
  await expectNote(page, "seed-1", ["**bold**", "plain"]);
});

test("the indent line starts below the note and is continuous", async () => {
  const page = await launch(5);
  await addNote(page, "seed-1", "note 1");
  await addNote(page, "seed-2", "note 2\nsecond line");
  const line = (nodeId: string) =>
    row(page, nodeId)
      .locator('[data-testid="indent-line"][data-level="0"]')
      .evaluate((el) => {
        const { top, bottom } = el.getBoundingClientRect();
        return { top, bottom };
      });
  await expect(row(page, "seed-1").getByTestId("indent-line")).toHaveCount(0);
  const noteBottom = await note(page, "seed-1").evaluate(
    (el) => el.getBoundingClientRect().bottom,
  );
  const lines = await Promise.all(["seed-2", "seed-3", "seed-4"].map(line));
  expect(lines[0].top).toBeGreaterThanOrEqual(noteBottom);
  expect(lines[0].bottom - lines[0].top).toBeGreaterThan(55);
  expect(lines[1].top).toBeCloseTo(lines[0].bottom, 1);
  expect(lines[2].top).toBeCloseTo(lines[1].bottom, 1);
});

test("collapsing over a note moves the cursor to the collapsed node", async () => {
  const page = await launch(3);
  await addNote(page, "seed-3", "note");
  await row(page, "seed-1").getByRole("button").click();
  await expectPlace(page, "seed-1:text:0:6");
});

test("a note is there after a restart", async () => {
  launched = await launchApp();
  let page = await launched.app.firstWindow();
  await page.locator(".cm-content").click();
  await page.keyboard.type("text");
  await page.keyboard.press("Shift+Enter");
  await typeLines(page, "one\ntwo");
  await launched.restart();
  page = await launched.app.firstWindow();
  const fields = page.locator("[data-node-field]");
  await expect(fields).toHaveCount(2);
  await expect(fields.nth(0)).toHaveText("text");
  await expect
    .poll(() => fields.nth(1).locator(".cm-line").allTextContents())
    .toEqual(["one", "two"]);
});
