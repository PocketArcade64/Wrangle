import { gameState } from './GameState';

/**
 * Release critters from the herd and empty any posse slots those exact
 * critters were riding in (slots hold uids). Callers enforce the guards
 * (never release favorites, never empty the herd entirely).
 */
export function releaseCritters(uids: string[]): void {
  gameState.data.herd = gameState.data.herd.filter((c) => !uids.includes(c.uid));
  const remaining = new Set(gameState.data.herd.map((c) => c.uid));
  for (const team of gameState.data.teams) {
    team.members = team.members.map((m) => (m && remaining.has(m) ? m : null));
  }
  gameState.save();
}
