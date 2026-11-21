import type { ChangeSet } from "../../../shared/outline/change-set";
import {
  NODE_FORMATS,
  type JsonValue,
  type Node,
  type NodeAttributes,
  type NodeFormat,
} from "../../../shared/outline/node";
import { OutlineError } from "./errors";
import type { OutlineModel } from "./model";

type NodeFields = Partial<
  Pick<Node, "text" | "note" | "format" | "completedAt" | "attributes">
>;

export function setText(
  model: OutlineModel,
  id: string,
  text: string,
): ChangeSet {
  const node = model.getNode(id);
  if (node.type === "attachment" && text !== "") {
    throw new OutlineError(
      "attachmentText",
      "An attachment node cannot have text",
    );
  }
  return update(model, node, { text });
}

export function setNote(
  model: OutlineModel,
  id: string,
  note: string,
): ChangeSet {
  return update(model, model.getNode(id), { note });
}

export function setFormat(
  model: OutlineModel,
  id: string,
  format: NodeFormat,
): ChangeSet {
  const node = model.getNode(id);
  checkFormat(format);
  return update(model, node, { format });
}

/** Completing an already completed node keeps its original `completedAt`. */
export function setCompleted(
  model: OutlineModel,
  ids: readonly string[],
  completed: boolean,
): ChangeSet {
  const nodes = ids.map((id) => model.getNode(id));
  const now = model.now();
  return model.record(() => {
    for (const node of nodes) {
      const current = model.getNode(node.id);
      if (completed && current.completedAt === null) {
        model.putNode({ ...current, completedAt: now, modifiedAt: now });
      }
      if (!completed && current.completedAt !== null) {
        model.putNode({ ...current, completedAt: null, modifiedAt: now });
      }
    }
  });
}

/** UI state is per device, so it does not change `modifiedAt` of the node. */
export function setCollapsed(
  model: OutlineModel,
  id: string,
  collapsed: boolean,
): ChangeSet {
  model.getNode(id);
  const current = model.uiState.get(id);
  if ((current?.collapsed ?? false) === collapsed) {
    return model.record(() => {});
  }
  return model.record(() =>
    model.putUiState({
      nodeId: id,
      collapsed,
      scrollTop: current?.scrollTop ?? null,
    }),
  );
}

export function setAttribute(
  model: OutlineModel,
  id: string,
  key: string,
  value: JsonValue,
): ChangeSet {
  const node = model.getNode(id);
  if (key === "") {
    throw new OutlineError(
      "invalidAttributeKey",
      "An attribute key cannot be empty",
    );
  }
  if (!isJsonValue(value)) {
    throw new OutlineError(
      "invalidAttributeValue",
      `The value of ${key} is not a JSON value`,
    );
  }
  const current = node.attributes?.[key];
  if (
    current !== undefined &&
    JSON.stringify(current) === JSON.stringify(value)
  ) {
    return model.record(() => {});
  }
  const attributes: NodeAttributes = {
    ...node.attributes,
    [key]: structuredClone(value),
  };
  return update(model, node, { attributes });
}

/** Removing a missing key changes nothing. */
export function removeAttribute(
  model: OutlineModel,
  id: string,
  key: string,
): ChangeSet {
  const node = model.getNode(id);
  if (node.attributes === undefined || !Object.hasOwn(node.attributes, key)) {
    return model.record(() => {});
  }
  const { [key]: _removed, ...attributes } = node.attributes;
  const { attributes: _old, ...base } = node;
  const next: Node =
    Object.keys(attributes).length > 0
      ? { ...base, attributes, modifiedAt: model.now() }
      : { ...base, modifiedAt: model.now() };
  return model.record(() => model.putNode(next));
}

export function checkFormat(format: string): void {
  if (!(NODE_FORMATS as readonly string[]).includes(format)) {
    throw new OutlineError("invalidFormat", `Unknown format ${format}`);
  }
}

function update(
  model: OutlineModel,
  node: Node,
  fields: NodeFields,
): ChangeSet {
  const changed = (Object.keys(fields) as (keyof NodeFields)[]).some(
    (key) => fields[key] !== node[key],
  );
  if (!changed) {
    return model.record(() => {});
  }
  return model.record(() =>
    model.putNode({ ...node, ...fields, modifiedAt: model.now() }),
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return false;
    }
    return Object.values(value).every(isJsonValue);
  }
  return false;
}
