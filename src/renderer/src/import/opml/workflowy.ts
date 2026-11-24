import type { NewNode } from "@/renderer/src/outline/commands/insert-tree";
import {
  htmlToNote,
  htmlToText,
} from "@/renderer/src/import/markdown/html-to-markdown";
import { ImportError } from "@/renderer/src/import/opml/import-error";
import { parseOpml, type OpmlOutline } from "@/renderer/src/import/opml/opml";

/** Parses an OPML file exported from Workflowy, or throws an `ImportError`. */
export function parseWorkflowy(source: string): NewNode[] {
  const outlines = parseOpml(source);
  if (outlines.length === 0) {
    throw new ImportError("The file has no nodes.");
  }
  const roots: NewNode[] = [];
  const stack = [{ outlines, nodes: roots }];
  for (let level = stack.pop(); level !== undefined; level = stack.pop()) {
    for (const outline of level.outlines) {
      const node = toNode(outline);
      level.nodes.push(node);
      if (outline.children.length > 0) {
        stack.push({ outlines: outline.children, nodes: node.children });
      }
    }
  }
  return roots;
}

function toNode(outline: OpmlOutline): NewNode & { children: NewNode[] } {
  return {
    text: copy(htmlToText(outline.text)),
    note: copy(htmlToNote(outline.note)),
    completed: outline.completed,
    children: [],
  };
}

/** A part of a string keeps the whole string in memory, here the file. */
function copy(text: string): string {
  return ` ${text}`.slice(1);
}
