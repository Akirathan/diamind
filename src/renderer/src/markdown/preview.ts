import {
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type PluginValue,
  type ViewUpdate,
} from "@codemirror/view";
import {
  buildDecorations,
  LINK_URL_ATTRIBUTE,
  RENDERED_LINK_ROLE,
} from "@/renderer/src/markdown/decorations";
import {
  parseInlineMarkdown,
  type InlineSpan,
} from "@/renderer/src/markdown/inline-markdown";

class MarkdownPreview implements PluginValue {
  decorations: DecorationSet;
  private spans: readonly InlineSpan[];
  private mouseDown = false;
  private stale = false;

  constructor(private readonly view: EditorView) {
    this.spans = parseInlineMarkdown(view.state.doc.toString());
    this.decorations = this.build();
  }

  update(update: ViewUpdate): void {
    if (update.docChanged) {
      this.spans = parseInlineMarkdown(update.state.doc.toString());
      this.decorations = this.build();
      return;
    }
    if (this.spans.length === 0) {
      return;
    }
    if (update.selectionSet || update.focusChanged) {
      this.stale = true;
    }
    if (this.stale && !this.mouseDown) {
      this.decorations = this.build();
    }
  }

  destroy(): void {
    this.setMouseDown(false);
  }

  onMouseDown(event: MouseEvent): boolean {
    if (event.button !== 0) {
      return false;
    }
    if (linkToOpen(event) !== null) {
      // Keeps the cursor where it is, so the link stays rendered.
      return true;
    }
    this.setMouseDown(true);
    return false;
  }

  onClick(event: MouseEvent): boolean {
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
  }

  private build(): DecorationSet {
    this.stale = false;
    const { view } = this;
    return buildDecorations(
      this.spans,
      view.hasFocus ? view.state.selection.ranges : [],
    );
  }

  /** Markers that appear under a pressed mouse would move the text, and the mouse would select it. */
  private setMouseDown(mouseDown: boolean): void {
    this.mouseDown = mouseDown;
    for (const type of ["mouseup", "dragend"]) {
      if (mouseDown) {
        window.addEventListener(type, this.onMouseUp);
      } else {
        window.removeEventListener(type, this.onMouseUp);
      }
    }
  }

  private readonly onMouseUp = (): void => {
    this.setMouseDown(false);
    if (this.stale) {
      this.view.dispatch({});
    }
  };
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
export const markdownPreview = ViewPlugin.fromClass(MarkdownPreview, {
  decorations: (preview) => preview.decorations,
  eventHandlers: {
    mousedown(event) {
      return this.onMouseDown(event);
    },
    click(event) {
      return this.onClick(event);
    },
  },
});
