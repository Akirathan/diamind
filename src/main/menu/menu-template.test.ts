import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { MENU_COMMANDS } from "@/shared/menu";
import { menuTemplate, type MenuOptions } from "@/main/menu/menu-template";

function items(options: Partial<MenuOptions> = {}) {
  const menus = menuTemplate({
    isMac: true,
    isDevelopment: false,
    onCommand: () => {},
    ...options,
  });
  return menus.flatMap(
    (menu) => (menu.submenu as MenuItemConstructorOptions[]) ?? [menu],
  );
}

function roles(options: Partial<MenuOptions> = {}) {
  return items(options).map((item) => item.role);
}

describe("menuTemplate", () => {
  it("has one item for each command", () => {
    const onCommand = vi.fn();
    const all = items({ onCommand });
    for (const command of MENU_COMMANDS) {
      const matching = all.filter((item) => item.id === command);
      expect(matching).toHaveLength(1);
      (matching[0].click as () => void)();
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
  });

  it("has no native undo", () => {
    expect(roles()).not.toContain("undo");
    expect(roles()).not.toContain("redo");
  });

  it("keeps the standard items", () => {
    expect(roles()).toEqual(
      expect.arrayContaining([
        "appMenu",
        "close",
        "cut",
        "copy",
        "paste",
        "selectAll",
        "resetZoom",
        "zoomIn",
        "zoomOut",
        "togglefullscreen",
        "windowMenu",
      ]),
    );
  });

  it.each(["reload", "forceReload", "toggleDevTools"])(
    "has %s only in development",
    (role) => {
      expect(roles()).not.toContain(role);
      expect(roles({ isDevelopment: true })).toContain(role);
    },
  );

  it("has the quit item in the File menu if there is no app menu", () => {
    expect(roles({ isMac: false })).not.toContain("appMenu");
    expect(roles({ isMac: false })).toContain("quit");
  });
});
