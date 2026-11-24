import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  previewField,
  previewState,
  setFocused,
  setMouseDown,
} from "@/renderer/src/markdown/preview-state";

function create(doc: string, focused = true, anchor = 0): EditorState {
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: previewState,
  });
  return state.update({ effects: setFocused.of(focused) }).state;
}

function select(state: EditorState, anchor: number, head = anchor) {
  return state.update({ selection: { anchor, head } }).state;
}

function click(state: EditorState, pos: number): number {
  return state.update({
    selection: EditorSelection.cursor(pos),
    userEvent: "select.pointer",
  }).state.selection.main.head;
}

function hiddenRanges(state: EditorState): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  state
    .field(previewField)
    .decorations.between(0, state.doc.length, (from, to, { spec }) => {
      if (spec.class === undefined) {
        ranges.push({ from, to });
      }
    });
  return ranges;
}

/** The text without the hidden markers. */
function visibleText(state: EditorState): string {
  let text = "";
  let pos = 0;
  for (const { from, to } of hiddenRanges(state)) {
    text += state.sliceDoc(pos, from);
    pos = to;
  }
  return text + state.sliceDoc(pos);
}

const SOURCE = "a **b** c [d](https://e.f) `g`";
const ALL_HIDDEN = "a b c d g";

describe("marker visibility", () => {
  it("hides all markers of an editor without focus", () => {
    for (let pos = 0; pos <= SOURCE.length; pos++) {
      expect(visibleText(create(SOURCE, false, pos))).toBe(ALL_HIDDEN);
    }
  });

  it.each([
    [0, ALL_HIDDEN],
    [1, ALL_HIDDEN],
    [2, "a **b** c d g"],
    [4, "a **b** c d g"],
    [7, "a **b** c d g"],
    [8, ALL_HIDDEN],
    [10, "a b c [d](https://e.f) g"],
    [26, "a b c [d](https://e.f) g"],
    [27, "a b c d `g`"],
  ])("shows the markers around the cursor at %i", (pos, text) => {
    expect(visibleText(select(create(SOURCE), pos))).toBe(text);
  });

  it("shows the markers of all spans that a selection touches", () => {
    expect(visibleText(select(create(SOURCE), 3, 12))).toBe(
      "a **b** c [d](https://e.f) g",
    );
    expect(visibleText(select(create(SOURCE), 30, 0))).toBe(SOURCE);
  });

  it("follows the focus", () => {
    let state = create(SOURCE, true, 4);
    expect(visibleText(state)).toBe("a **b** c d g");
    state = state.update({ effects: setFocused.of(false) }).state;
    expect(visibleText(state)).toBe(ALL_HIDDEN);
    state = state.update({ effects: setFocused.of(true) }).state;
    expect(visibleText(state)).toBe("a **b** c d g");
  });

  it("decides for nested spans one by one", () => {
    const source = "**a _b_ c**";
    expect(visibleText(select(create(source), 2))).toBe("**a b c**");
    expect(visibleText(select(create(source), 5))).toBe(source);
  });

  it("follows the text", () => {
    let state = create("**b*", true, 4);
    expect(visibleText(state)).toBe("**b*");
    state = state.update({
      changes: { from: 4, insert: "* c" },
      selection: { anchor: 7 },
    }).state;
    expect(visibleText(state)).toBe("b c");
  });

  it("does not change while the mouse is pressed", () => {
    let state = create(SOURCE);
    state = state.update({ effects: setMouseDown.of(true) }).state;
    state = select(state, 4);
    expect(visibleText(state)).toBe(ALL_HIDDEN);
    state = state.update({ effects: setMouseDown.of(false) }).state;
    expect(visibleText(state)).toBe("a **b** c d g");
  });

  it.each([SOURCE, "***a***", "[**b**](https://c.d)`e`", "**a _b_ c**_d_"])(
    "never hides text next to the cursor in %s",
    (source) => {
      let state = create(source);
      for (let pos = 0; pos <= source.length; pos++) {
        state = select(state, pos);
        for (const { from, to } of hiddenRanges(state)) {
          expect(pos < from || pos > to).toBe(true);
        }
      }
    },
  );
});

describe("cursor next to hidden markers", () => {
  it("moves to the outer side of the hidden markers", () => {
    const state = create("x **b** y");
    expect(click(state, 4)).toBe(2);
    expect(click(state, 3)).toBe(2);
    expect(click(state, 5)).toBe(7);
    expect(click(state, 6)).toBe(7);
  });

  it("moves out of nested markers", () => {
    const state = create("x [**b**](https://c.d)");
    expect(click(state, 5)).toBe(2);
    expect(click(state, 6)).toBe(22);
  });

  it("stays inside of a hidden span, away from its markers", () => {
    expect(click(create("x **bold** y"), 6)).toBe(6);
  });

  it("stays next to visible markers", () => {
    expect(click(create("x **b** y", true, 4), 5)).toBe(5);
  });

  it("keeps selections", () => {
    const { state } = create("x **b** y").update({
      selection: { anchor: 4, head: 5 },
      userEvent: "select.pointer",
    });
    expect([state.selection.main.anchor, state.selection.main.head]).toEqual([
      4, 5,
    ]);
  });

  it("keeps a cursor that is not placed by the user", () => {
    expect(select(create("x **b** y"), 5).selection.main.head).toBe(5);
  });
});
