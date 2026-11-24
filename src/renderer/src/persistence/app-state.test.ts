import { describe, expect, it } from "vitest";
import type { AppStateValues } from "@/shared/app-state";
import { AppStateStore } from "@/renderer/src/persistence/app-state";

describe("AppStateStore", () => {
  it("starts with the saved values", () => {
    const state = new AppStateStore({ zoomedNodeId: "a" });
    expect(state.get("zoomedNodeId")).toBe("a");
    expect(state.get("navigationHistory")).toBeUndefined();
  });

  it("notifies about changed values only", () => {
    const state = new AppStateStore({ zoomedNodeId: "a" });
    const changes: AppStateValues[] = [];
    const unsubscribe = state.subscribe((changed) => changes.push(changed));
    state.set("zoomedNodeId", "a");
    state.set("zoomedNodeId", "b");
    unsubscribe();
    state.set("zoomedNodeId", "c");
    expect(changes).toEqual([{ zoomedNodeId: "b" }]);
    expect(state.get("zoomedNodeId")).toBe("c");
  });
});
