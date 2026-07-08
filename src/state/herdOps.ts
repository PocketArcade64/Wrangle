import { gameState } from './GameState';

/**
 * Release critters from the herd and clean up any posse slots whose species
 * no longer exists in the herd. Callers enforce the guards (never release
 * favorites, never empty the herd entirely).
 */
export function releaseCritters(uids: string[]): void {
  gameState.data.herd = gameState.data.herd.filter((c) => !uids.includes(c.uid));
  const remaining = new Set(gameState.data.herd.map((c) => c.speciesId));
  for (const team of gameState.data.teams) {
    team.members = team.members.map((m) => (m && remaining.has(m) ? m : null));
  }
  gameState.save();
}
