/** The application menu items that the renderer handles. Each command is also the id of its item. */
export const MENU_COMMANDS = ["undo", "redo"] as const;
export type MenuCommand = (typeof MENU_COMMANDS)[number];
