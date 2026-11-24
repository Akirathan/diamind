import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  LINK_URL_ATTRIBUTE,
  RENDERED_LINK_ROLE,
} from "@/renderer/src/markdown/decorations";
import {
  previewField,
  previewState,
  setFocused,
  setMouseDown,
} from "@/renderer/src/markdown/preview-state";

const handlers = EditorView.domEventHandlers({
  focus: (_event, view) => updateFocus(view, true),
  blur: (_event, view) => updateFocus(view, false),
  mousedown(event, view) {
    if (event.button !== 0) {
      return false;
    }
    if (linkToOpen(event) !== null) {
      // Keeps the cursor where it is, so the link stays rendered.
      return true;
    }
    if (view.state.field(previewField).spans.length > 0) {
      trackMouse(view);
    }
    return false;
  },
  click(event) {
    const url = linkToOpen(event);
    if (url === null) {
      return false;
    }
    // The second click of a double click does not open the link again.
    if (event.detail <= 1) {
      window.diamind.openLink(url).catch((error: unknown) => {
        console.error(`Cannot open ${url}`, error);
      });
    }
    return true;
  },
});

/** The view cannot be changed yet if the focus moved during its update. */
function updateFocus(view: EditorView, focused: boolean): false {
  queueMicrotask(() => {
    if (view.state.field(previewField).focused !== focused) {
      view.dispatch({ effects: setFocused.of(focused) });
    }
  });
  return false;
}

function trackMouse(view: EditorView): void {
  view.dispatch({ effects: setMouseDown.of(true) });
  const controller = new AbortController();
  for (const type of ["mouseup", "dragend"]) {
    window.addEventListener(
      type,
      () => {
        controller.abort();
        view.dispatch({ effects: setMouseDown.of(false) });
      },
      { signal: controller.signal },
    );
  }
}

/** A link with the cursor inside is open for editing, so it needs `Cmd` or `Ctrl` to be opened. */
function linkToOpen(event: MouseEvent): string | null {
  if (!(event.target instanceof Element) || event.shiftKey || event.altKey) {
    return null;
  }
  const link = event.target.closest(`[${LINK_URL_ATTRIBUTE}]`);
  if (link === null) {
    return null;
  }
  const rendered = link.getAttribute("role") === RENDERED_LINK_ROLE;
  return rendered || event.metaKey || event.ctrlKey
    ? link.getAttribute(LINK_URL_ATTRIBUTE)
    : null;
}

/** Shows inline markdown formatted and without its markers, except around the cursor. */
export const markdownPreview: Extension = [previewState, handlers];
