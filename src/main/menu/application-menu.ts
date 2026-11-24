import { app, Menu, type BrowserWindow } from "electron";
import { IpcChannel } from "@/shared/api";
import { MENU_COMMANDS } from "@/shared/menu";
import { menuTemplate } from "@/main/menu/menu-template";

export function setApplicationMenu(
  getWindow: () => BrowserWindow | null,
): void {
  const template = menuTemplate({
    isMac: process.platform === "darwin",
    isDevelopment: !app.isPackaged,
    onCommand: (command) =>
      getWindow()?.webContents.send(IpcChannel.MenuCommand, command),
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** On macOS, the menu stays when the window is closed. */
export function setMenuCommandsEnabled(enabled: boolean): void {
  for (const command of MENU_COMMANDS) {
    const item = Menu.getApplicationMenu()?.getMenuItemById(command);
    if (item) {
      item.enabled = enabled;
    }
  }
}
