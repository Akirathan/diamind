import type { MenuItemConstructorOptions } from "electron";
import type { MenuCommand } from "@/shared/menu";

export interface MenuOptions {
  isMac: boolean;
  isDevelopment: boolean;
  onCommand: (command: MenuCommand) => void;
}

export function menuTemplate({
  isMac,
  isDevelopment,
  onCommand,
}: MenuOptions): MenuItemConstructorOptions[] {
  function commandItem(
    command: MenuCommand,
    label: string,
    accelerator?: string,
  ): MenuItemConstructorOptions {
    return {
      id: command,
      label,
      accelerator,
      click: () => onCommand(command),
    };
  }

  const appMenu: MenuItemConstructorOptions[] = [{ role: "appMenu" }];
  const developmentItems: MenuItemConstructorOptions[] = [
    { role: "reload" },
    { role: "forceReload" },
    { role: "toggleDevTools" },
    { type: "separator" },
  ];
  return [
    ...(isMac ? appMenu : []),
    {
      label: "File",
      submenu: [
        commandItem("importWorkflowy", "Import from Workflowy..."),
        { type: "separator" },
        { role: isMac ? "close" : "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        commandItem("undo", "Undo", "CommandOrControl+Z"),
        commandItem("redo", "Redo", "Shift+CommandOrControl+Z"),
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        ...(isDevelopment ? developmentItems : []),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
}
