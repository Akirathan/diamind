export interface OutlineNode {
  id: string;
  parentId: string | null;
  order: string;
  text: string;
  format: "bullet";
  collapsed: boolean;
  createdAt: number;
  modifiedAt: number;
}

export interface TextEdit {
  nodeIndex: number;
  position: number;
  deleteCount: number;
  insert: string;
  at: number;
}

export type Random = () => number;

const MAX_DEPTH = 12;
const START_TIME = Date.UTC(2020, 0, 1);
const ID_ALPHABET = [
  ..."0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-",
];

const WORDS = (
  "the a of to and in is for on with that this note idea task meeting project " +
  "review design draft plan todo done later check read write call email fix " +
  "bug feature release notes book article link summary question answer goal " +
  "week month budget travel home work family health code test build deploy " +
  "server client data model node tree search filter index cache memory disk"
).split(" ");

// mulberry32
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}

function createId(random: Random): string {
  let id = "";
  for (let i = 0; i < 21; i++) {
    id += pick(ID_ALPHABET, random);
  }
  return id;
}

function createText(random: Random): string {
  const wordCount = Math.floor(random() ** 1.5 * 20) + 1;
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(pick(WORDS, random));
  }
  return words.join(" ");
}

// Nodes come in document order, so each parent precedes its children.
export function generateOutline(count: number, random: Random): OutlineNode[] {
  const nodes: OutlineNode[] = [];
  const ancestors: string[] = [];
  const childCounts = new Map<string | null, number>();
  let lastId: string | null = null;
  let time = START_TIME;

  for (let i = 0; i < count; i++) {
    const roll = random();
    if (lastId !== null && roll < 0.3 && ancestors.length < MAX_DEPTH) {
      ancestors.push(lastId);
    } else if (roll > 0.85) {
      ancestors.pop();
      if (roll > 0.95) {
        ancestors.pop();
      }
    }

    const parentId = ancestors.at(-1) ?? null;
    const siblingIndex = childCounts.get(parentId) ?? 0;
    childCounts.set(parentId, siblingIndex + 1);
    time += Math.floor(random() * 600_000);

    const id = createId(random);
    nodes.push({
      id,
      parentId,
      order: "a" + siblingIndex.toString(36),
      text: createText(random),
      format: "bullet",
      collapsed: random() < 0.1,
      createdAt: time,
      modifiedAt: time,
    });
    lastId = id;
  }
  return nodes;
}

export function generateEdits(
  nodes: readonly OutlineNode[],
  count: number,
  random: Random,
): TextEdit[] {
  const lengths = nodes.map((node) => node.text.length);
  let time = nodes.at(-1)?.modifiedAt ?? START_TIME;
  const edits: TextEdit[] = [];

  for (let i = 0; i < count; i++) {
    const nodeIndex = Math.floor(random() * nodes.length);
    const length = lengths[nodeIndex];
    const position = Math.floor(random() * (length + 1));
    const deleteCount = Math.min(length - position, Math.floor(random() * 5));
    const insert = pick(WORDS, random) + " ";
    lengths[nodeIndex] += insert.length - deleteCount;
    time += Math.floor(random() * 60_000);
    edits.push({ nodeIndex, position, deleteCount, insert, at: time });
  }
  return edits;
}

export function applyEdit(text: string, edit: TextEdit): string {
  return (
    text.slice(0, edit.position) +
    edit.insert +
    text.slice(edit.position + edit.deleteCount)
  );
}
