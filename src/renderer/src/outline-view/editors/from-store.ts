import { Annotation } from "@codemirror/state";

/** Marks a transaction that copies a store change into the editor. */
export const fromStore = Annotation.define<boolean>();
