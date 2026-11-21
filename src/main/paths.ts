import { homedir } from "node:os";
import { join } from "node:path";

export function resolveDataDir(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  const override = env.DIAMIND_DATA_DIR;
  if (override) {
    return override;
  }
  return join(home, ".local", "share", "diamind");
}
