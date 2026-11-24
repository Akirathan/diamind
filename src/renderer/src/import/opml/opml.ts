import { decodeXml } from "@/renderer/src/import/markup/entities";
import { ImportError } from "@/renderer/src/import/opml/import-error";
import {
  parseTag,
  type MarkupTag,
} from "@/renderer/src/import/markup/markup-tag";

/** A node of an OPML file. `text` and `note` are HTML. */
export interface OpmlOutline {
  text: string;
  note: string;
  completed: boolean;
  children: OpmlOutline[];
}

export interface OpmlLimits {
  maxDepth: number;
  maxNodes: number;
}

export const OPML_LIMITS: OpmlLimits = { maxDepth: 500, maxNodes: 500_000 };

/**
 * Parses the outlines of an OPML file, or throws an `ImportError`.
 * It reads only tags and attributes: document types, and with them custom and
 * external entities, are rejected.
 */
export function parseOpml(
  source: string,
  limits: OpmlLimits = OPML_LIMITS,
): OpmlOutline[] {
  const roots: OpmlOutline[] = [];
  const openElements: string[] = [];
  const openOutlines: OpmlOutline[] = [];
  let nodeCount = 0;
  let hasOpml = false;

  function open(tag: MarkupTag): void {
    if (openElements.length === 0 && (hasOpml || tag.name !== "opml")) {
      throw new ImportError("The file is not an OPML file.");
    }
    hasOpml = true;
    const isOutline = tag.name === "outline" && openElements[1] === "body";
    if (isOutline) {
      nodeCount++;
      if (nodeCount > limits.maxNodes) {
        throw new ImportError(
          `The file has more than ${limits.maxNodes} nodes.`,
        );
      }
      const outline = toOutline(tag);
      const parent = openOutlines.at(-1);
      (parent?.children ?? roots).push(outline);
      if (!tag.selfClosing) {
        openOutlines.push(outline);
      }
    }
    if (!tag.selfClosing) {
      openElements.push(tag.name);
      // `opml` and `body` are elements too.
      if (openElements.length > limits.maxDepth + 2) {
        throw new ImportError(
          `The nodes of the file are nested in more than ${limits.maxDepth} levels.`,
        );
      }
    }
  }

  function close(name: string, position: number): void {
    if (openElements.pop() !== name) {
      throw malformed(position);
    }
    if (name === "outline" && openElements[1] === "body") {
      openOutlines.pop();
    }
  }

  let pos = skipByteOrderMark(source);
  for (;;) {
    const next = source.indexOf("<", pos);
    const text = source.slice(pos, next < 0 ? source.length : next);
    if (openElements.length === 0 && text.trim() !== "") {
      throw hasOpml
        ? malformed(pos)
        : new ImportError("The file is not an OPML file.");
    }
    if (next < 0) {
      break;
    }
    const skipped = skipNonElement(source, next);
    if (skipped !== null) {
      pos = skipped;
      continue;
    }
    const tag = parseTag(source, next);
    if (tag === null) {
      throw malformed(next);
    }
    if (tag.closing) {
      close(tag.name, next);
    } else {
      open(tag);
    }
    pos = tag.end;
  }
  if (!hasOpml || openElements.length > 0) {
    throw malformed(source.length);
  }
  return roots;
}

function toOutline({ attributes }: MarkupTag): OpmlOutline {
  return {
    text: decodeXml(attributes.get("text") ?? ""),
    note: decodeXml(attributes.get("_note") ?? ""),
    completed: attributes.get("_complete") === "true",
    children: [],
  };
}

/** Skips a comment, a processing instruction or a CDATA section. */
function skipNonElement(source: string, start: number): number | null {
  const ends = [
    ["<!--", "-->"],
    ["<![CDATA[", "]]>"],
    ["<?", "?>"],
  ];
  for (const [prefix, suffix] of ends) {
    if (source.startsWith(prefix, start)) {
      const end = source.indexOf(suffix, start + prefix.length);
      if (end < 0) {
        throw malformed(start);
      }
      return end + suffix.length;
    }
  }
  if (source.startsWith("<!", start)) {
    throw new ImportError("A document type declaration is not supported.");
  }
  return null;
}

function skipByteOrderMark(source: string): number {
  return source.startsWith("﻿") ? 1 : 0;
}

function malformed(position: number): ImportError {
  return new ImportError(
    `The file is malformed or not complete (at character ${position}).`,
  );
}
