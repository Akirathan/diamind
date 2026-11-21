import * as Y from "yjs";
import {
  applyEdit,
  type OutlineNode,
  type Random,
  type TextEdit,
} from "./outline.ts";

export interface History {
  edits: readonly TextEdit[];
  sessions: number;
  random: Random;
}

export interface LoadedOutline {
  buildChildIndex(): Map<string | null, string[]>;
  countMatches(needle: string): number;
}

export interface Variant {
  name: VariantName;
  save(nodes: readonly OutlineNode[], history: History): Uint8Array;
  load(bytes: Uint8Array): LoadedOutline;
}

export type VariantName = "plain" | "yjs-text" | "yjs-string";

function sortChildren(
  index: Map<string | null, { id: string; order: string }[]>,
): Map<string | null, string[]> {
  const result = new Map<string | null, string[]>();
  for (const [parentId, children] of index) {
    children.sort((a, b) => (a.order < b.order ? -1 : 1));
    result.set(
      parentId,
      children.map((child) => child.id),
    );
  }
  return result;
}

const plain: Variant = {
  name: "plain",
  save(nodes, history) {
    const edited = nodes.map((node) => ({ ...node }));
    for (const edit of history.edits) {
      const node = edited[edit.nodeIndex];
      node.text = applyEdit(node.text, edit);
      node.modifiedAt = edit.at;
    }
    return new TextEncoder().encode(JSON.stringify(edited));
  },
  load(bytes) {
    const list: OutlineNode[] = JSON.parse(new TextDecoder().decode(bytes));
    const byId = new Map<string, OutlineNode>();
    for (const node of list) {
      byId.set(node.id, node);
    }
    return {
      buildChildIndex() {
        const index = new Map<string | null, { id: string; order: string }[]>();
        for (const node of byId.values()) {
          let children = index.get(node.parentId);
          if (children === undefined) {
            children = [];
            index.set(node.parentId, children);
          }
          children.push({ id: node.id, order: node.order });
        }
        return sortChildren(index);
      },
      countMatches(needle) {
        let count = 0;
        for (const node of byId.values()) {
          if (node.text.includes(needle)) {
            count++;
          }
        }
        return count;
      },
    };
  },
};

function randomClientId(random: Random): number {
  return Math.floor(random() * 0xffffffff);
}

// Each app start gets a new Yjs client ID. Items from different clients do not merge.
function buildDoc(
  nodes: readonly OutlineNode[],
  history: History,
  useYText: boolean,
): Y.Doc {
  const doc = new Y.Doc({ gc: true });
  const map = doc.getMap<Y.Map<unknown>>("nodes");
  const entries: Y.Map<unknown>[] = [];
  const transactionsPerSession = Math.ceil(
    (nodes.length + history.edits.length) / Math.max(1, history.sessions),
  );
  let transactions = 0;

  const transact = (change: () => void) => {
    if (transactions % transactionsPerSession === 0) {
      doc.clientID = randomClientId(history.random);
    }
    transactions++;
    doc.transact(change);
  };

  for (const node of nodes) {
    transact(() => {
      const entry = new Y.Map<unknown>();
      map.set(node.id, entry);
      entry.set("parentId", node.parentId);
      entry.set("order", node.order);
      entry.set("format", node.format);
      entry.set("collapsed", node.collapsed);
      entry.set("createdAt", node.createdAt);
      entry.set("modifiedAt", node.modifiedAt);
      entry.set("text", useYText ? new Y.Text(node.text) : node.text);
      entries.push(entry);
    });
  }

  for (const edit of history.edits) {
    const entry = entries[edit.nodeIndex];
    transact(() => {
      const text = entry.get("text");
      if (text instanceof Y.Text) {
        text.delete(edit.position, edit.deleteCount);
        text.insert(edit.position, edit.insert);
      } else {
        entry.set("text", applyEdit(text as string, edit));
      }
      entry.set("modifiedAt", edit.at);
    });
  }
  return doc;
}

function loadDoc(bytes: Uint8Array): LoadedOutline {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, bytes);
  const map = doc.getMap<Y.Map<unknown>>("nodes");
  return {
    buildChildIndex() {
      const index = new Map<string | null, { id: string; order: string }[]>();
      for (const [id, entry] of map) {
        const parentId = entry.get("parentId") as string | null;
        let children = index.get(parentId);
        if (children === undefined) {
          children = [];
          index.set(parentId, children);
        }
        children.push({ id, order: entry.get("order") as string });
      }
      return sortChildren(index);
    },
    countMatches(needle) {
      let count = 0;
      for (const entry of map.values()) {
        const text = entry.get("text");
        const value = text instanceof Y.Text ? text.toString() : String(text);
        if (value.includes(needle)) {
          count++;
        }
      }
      return count;
    },
  };
}

function yjsVariant(name: VariantName, useYText: boolean): Variant {
  return {
    name,
    save(nodes, history) {
      return Y.encodeStateAsUpdate(buildDoc(nodes, history, useYText));
    },
    load: loadDoc,
  };
}

export const VARIANTS: readonly Variant[] = [
  plain,
  yjsVariant("yjs-text", true),
  yjsVariant("yjs-string", false),
];

export function findVariant(name: string): Variant {
  const variant = VARIANTS.find((candidate) => candidate.name === name);
  if (variant === undefined) {
    throw new Error(`Unknown variant: ${name}`);
  }
  return variant;
}
