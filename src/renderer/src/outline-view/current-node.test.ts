import { describe, expect, it } from "vitest";
import { createOutline } from "@/renderer/src/outline/test-outline";
import { CurrentNode } from "@/renderer/src/outline-view/current-node";

const SOURCE = `
  a
    a1
      a11
    a2
  b
`;

function setup(currentId: string | null) {
  const { store } = createOutline(SOURCE);
  const currentNode = new CurrentNode(store);
  currentNode.set(currentId);
  let notified = 0;
  currentNode.subscribe(() => notified++);
  return { store, currentNode, notified: () => notified };
}

describe("CurrentNode", () => {
  it("notifies only when the node changes", () => {
    const { currentNode, notified } = setup("a");
    currentNode.set("a");
    expect(notified()).toBe(0);
    currentNode.set("b");
    expect(notified()).toBe(1);
    expect(currentNode.get()).toBe("b");
  });

  it("moves to the node that collapses over it", () => {
    const { store, currentNode, notified } = setup("a11");
    store.setCollapsed("a", true);
    expect(currentNode.get()).toBe("a");
    expect(notified()).toBe(1);
  });

  it("stays when the current node itself or another subtree collapses", () => {
    const { store, currentNode } = setup("a2");
    store.setCollapsed("a1", true);
    store.setCollapsed("a2", true);
    expect(currentNode.get()).toBe("a2");
  });

  it("moves to the topmost of several nodes that collapse", () => {
    const { store, currentNode } = setup("a11");
    store.restoreRows({
      nodes: { put: [], remove: [] },
      uiState: {
        put: ["a1", "a"].map((nodeId) => ({
          nodeId,
          collapsed: true,
          scrollTop: null,
        })),
        remove: [],
      },
    });
    expect(currentNode.get()).toBe("a");
  });

  it("stays on expand and on text changes", () => {
    const { store, currentNode, notified } = setup("a11");
    store.setText("a11", "x");
    store.setCollapsed("b", true);
    store.setCollapsed("b", false);
    expect(currentNode.get()).toBe("a11");
    expect(notified()).toBe(0);
  });

  it("is empty after the node is deleted, also with an ancestor", () => {
    const { store, currentNode } = setup("a11");
    store.deleteNode("a");
    expect(currentNode.get()).toBeNull();
  });
});
