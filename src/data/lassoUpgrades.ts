/**
 * Lasso upgrade system - single source of truth for costs and effects.
 * Levels live in gameState.data.lasso; CaptureScene reads effects from here
 * so the shop and the gameplay can never disagree.
 */
export type LassoStat = 'rope' | 'grit' | 'charge';

export interface LassoUpgradeDef {
  key: LassoStat;
  name: string;
  desc: string;
  maxLevel: number;
  /** Cost of level 1; level n -> n+1 costs baseCost * (n + 1). */
  baseCost: number;
}

export const LASSO_UPGRADES: LassoUpgradeDef[] = [
  {
    key: 'rope',
    name: 'ROPE LENGTH',
    desc: 'More rope on the field before it snaps.',
    maxLevel: 5,
    baseCost: 50
  },
  {
    key: 'grit',
    name: 'GRIT',
    desc: 'Extra health bars for your lasso.',
    maxLevel: 3,
    baseCost: 75
  },
  {
    key: 'charge',
    name: 'CHARGE',
    desc: 'The capture gauge holds its charge longer.',
    maxLevel: 5,
    baseCost: 50
  }
];

export function upgradeCost(def: LassoUpgradeDef, currentLevel: number): number {
  return def.baseCost * (currentLevel + 1);
}

// ---- effects (base values were the pre-upgrade constants) ----

/** Hidden max total line length on the field (~2.5 loops at level 0). */
export function ropeBudget(level: number): number {
  return 1500 + 150 * level;
}

/** Whole health bars. */
export function healthBars(level: number): number {
  return 5 + level;
}

/** Seconds without a loop before the capture gauge starts draining. */
export function gaugeDecayDelay(level: number): number {
  return 4 + 0.6 * level;
}

/** Loops' worth of gauge drained per second once decay kicks in. */
export function gaugeDecayRate(level: number): number {
  return 0.75 * (1 - 0.08 * level);
}
