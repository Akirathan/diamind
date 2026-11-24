const MAX_SEED_NODES = 1_000_000;

/** True if e2e tests run the app without a visible window. A packaged app never hides. */
export function resolveHidden(
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): boolean {
  return !isPackaged && env.DIAMIND_HIDDEN === "1";
}

/**
 * Number of generated nodes to seed the outline with, from `DIAMIND_SEED_NODES`.
 * Only for development and e2e tests; a packaged app never seeds.
 */
export function resolveSeedNodeCount(
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): number {
  const value = env.DIAMIND_SEED_NODES;
  if (isPackaged || value === undefined || !/^\d+$/.test(value)) {
    return 0;
  }
  return Math.min(Number(value), MAX_SEED_NODES);
}
