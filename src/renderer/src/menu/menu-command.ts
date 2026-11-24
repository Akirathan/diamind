import { useEffect } from "react";
import type { MenuCommand } from "@/shared/menu";

/** Calls `run` when the user selects the item of the application menu. */
export function useMenuCommand(command: MenuCommand, run: () => void): void {
  useEffect(
    () =>
      window.diamind.onMenuCommand((selected) => {
        if (selected === command) {
          run();
        }
      }),
    [command, run],
  );
}
