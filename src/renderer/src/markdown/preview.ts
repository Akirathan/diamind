import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { LINK_URL_ATTRIBUTE } from "@/renderer/src/markdown/decorations";
import { isOpenLinkClick } from "@/renderer/src/markdown/open-link-key";
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
      // Keeps the cursor where it is, so the link does not change under the mouse.
      return true;
    }
    if (view.state.field(previewField).markdown.spans.length > 0) {
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

function linkToOpen(event: MouseEvent): string | null {
  if (!(event.target instanceof Element) || !isOpenLinkClick(event)) {
    return null;
  }
  const link = event.target.closest(`[${LINK_URL_ATTRIBUTE}]`);
  return link?.getAttribute(LINK_URL_ATTRIBUTE) ?? null;
}

/** Shows inline markdown formatted and without its markers, except around the cursor. */
export const markdownPreview: Extension = [previewState, handlers];
