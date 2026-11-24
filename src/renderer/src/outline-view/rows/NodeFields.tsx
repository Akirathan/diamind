import {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { NodeField } from "@/renderer/src/outline/editing/cursor";
import type { OutlineSession } from "@/renderer/src/outline-view/session";

type Editors = OutlineSession["editors"];

interface NodeTextProps {
  nodeId: string;
  editors: Editors;
}

export function NodeText({ nodeId, editors }: NodeTextProps) {
  const ref = useEditor(editors, nodeId, "text");
  return <div ref={ref} data-node-field="text" />;
}

interface NodeNoteProps {
  nodeId: string;
  session: OutlineSession;
}

export function NodeNote({ nodeId, session }: NodeNoteProps) {
  const { editors, shownNotes } = session;
  const subscribe = useCallback(
    (listener: () => void) => shownNotes.subscribe(nodeId, listener),
    [shownNotes, nodeId],
  );
  const shown = useSyncExternalStore(subscribe, () =>
    shownNotes.isShown(nodeId),
  );
  return shown && <NoteEditor nodeId={nodeId} editors={editors} />;
}

function NoteEditor({ nodeId, editors }: NodeTextProps) {
  const ref = useEditor(editors, nodeId, "note");
  return (
    <div
      ref={ref}
      data-node-field="note"
      className="text-sm leading-5 text-neutral-500 dark:text-neutral-400"
    />
  );
}

/** Puts a pooled editor into the element. */
function useEditor(editors: Editors, nodeId: string, field: NodeField) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const parent = ref.current;
    if (parent === null) {
      return;
    }
    const fieldRef = { nodeId, field };
    const view = editors.mount(fieldRef, parent);
    return () => {
      editors.unmount(fieldRef, view);
    };
  }, [editors, nodeId, field]);

  return ref;
}
