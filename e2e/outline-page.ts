import { expect, type Page } from "@playwright/test";

const INDENT_PX = 24;

/** The rendered nodes in document order, two spaces of indentation per level. */
export async function outlineText(page: Page): Promise<string[]> {
  return page.locator(".cm-content").evaluateAll((contents, indent) => {
    const lefts = contents.map((content) => content.getBoundingClientRect().x);
    const min = Math.min(...lefts);
    return contents
      .map((content, i) => ({
        text: content.textContent ?? "",
        depth: Math.round((lefts[i] - min) / indent),
        top: content.getBoundingClientRect().top,
      }))
      .sort((a, b) => a.top - b.top)
      .map(({ text, depth }) => "  ".repeat(depth) + text);
  }, INDENT_PX);
}

export async function expectOutline(
  page: Page,
  expected: string[],
): Promise<void> {
  await expect.poll(() => outlineText(page)).toEqual(expected);
}

/** The text of the focused node with `|` at the cursor, or `null`. */
export function cursorText(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const content = document.activeElement;
    const selection = window.getSelection();
    if (
      content === null ||
      !content.classList.contains("cm-content") ||
      selection?.focusNode == null
    ) {
      return null;
    }
    const range = document.createRange();
    range.setStart(content, 0);
    range.setEnd(selection.focusNode, selection.focusOffset);
    const offset = range.toString().length;
    const text = content.textContent ?? "";
    return `${text.slice(0, offset)}|${text.slice(offset)}`;
  });
}

export async function expectCursor(
  page: Page,
  expected: string,
): Promise<void> {
  await expect.poll(() => cursorText(page)).toBe(expected);
}

/** Clicks into a node and moves the cursor. */
export async function putCursor(
  page: Page,
  nodeId: string,
  offset: number,
): Promise<void> {
  const row = page.locator(`[data-node-id="${nodeId}"]`);
  await row.locator(".cm-line").click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowUp" : "Control+Home",
  );
  for (let i = 0; i < offset; i++) {
    await page.keyboard.press("ArrowRight");
  }
  await expect
    .poll(async () => (await cursorText(page))?.indexOf("|"))
    .toBe(offset);
  await settle(page);
}

/** CodeMirror reads the DOM selection in an event, and the rows follow a scroll in a frame. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve)),
        );
      }),
  );
}

export async function scrollTo(page: Page, top: number): Promise<void> {
  await page.getByTestId("outline").evaluate((element, value) => {
    element.scrollTop = value;
  }, top);
  await settle(page);
}
