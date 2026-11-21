const MAX_SEED_NODES = 1_000_000;

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
