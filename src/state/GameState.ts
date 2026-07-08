export interface Pedigree {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/** One specific caught critter - the herd is made of these, not species. */
export interface CritterInstance {
  uid: string;
  speciesId: string;
  /**
   * PEDIGREE: this individual's bloodline quality - a hidden 0-15 bonus per
   * stat rolled at capture (the western rename of IVs).
   */
  pedigree: Pedigree;
  /** Favorites can't be released, turned in for bounties, or auctioned. */
  favorite: boolean;
  caughtAt: number;
  /** Battle level - XP is earned once battles land in M3. */
  level: number;
  /** XP into the current level (resets to 0 on level-up). */
  xp: number;
}

/** XP needed to go from `level` to `level + 1` (placeholder curve). */
export function xpForNextLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export interface WrangleSave {
  currency: number;
  stamina: number;
  staminaMax: number;
  dailyAvailable: boolean;
  leadCreatureId: string;
  biome: string;
  herd: CritterInstance[];
  /** Encounter counts per species id (incremented when a capture starts). */
  seen: Record<string, number>;
  /** Lasso upgrade levels (definitions in src/data/lassoUpgrades.ts). */
  lasso: { rope: number; grit: number; charge: number };
  /** Posses: teams of up to 3 critters (species ids, null = empty slot). */
  teams: { name: string; members: (string | null)[] }[];
  /** Index of the posse selected on the home carousel. */
  activeTeam: number;
  /** Daily bonus state - values are local dateKey() strings. */
  daily: { lastPunch: string; punchStreak: number; lastSpin: string };
  /** Drifter identity - name entry UI comes with the M6 save system. */
  playerName: string;
  playerLevel: number;
  playerXp: number;
}

const KEY = 'wrangle-save-v1';

const DEFAULTS: WrangleSave = {
  currency: 250,
  stamina: 4,
  staminaMax: 4,
  dailyAvailable: true,
  leadCreatureId: 'herbifuzz',
  biome: 'DUSTY FLATS',
  herd: [],
  seen: {},
  lasso: { rope: 0, grit: 0, charge: 0 },
  teams: [{ name: 'POSSE 1', members: [null, null, null] }],
  activeTeam: 0,
  daily: { lastPunch: '', punchStreak: 0, lastSpin: '' },
  playerName: 'THE DRIFTER',
  playerLevel: 1,
  playerXp: 0
};

export function rollPedigree(): Pedigree {
  const r = () => Math.floor(Math.random() * 16);
  return { hp: r(), atk: r(), def: r(), spa: r(), spd: r(), spe: r() };
}

export function newCritter(speciesId: string): CritterInstance {
  return {
    uid: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    speciesId,
    pedigree: rollPedigree(),
    favorite: false,
    caughtAt: Date.now(),
    level: 1,
    xp: 0
  };
}

/**
 * Minimal persistent player state (localStorage). Grows into the full save
 * system in M6; keep all reads/writes going through this module.
 */
class GameStateStore {
  data: WrangleSave;

  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<WrangleSave>) };
    } catch {
      // corrupted or unavailable storage - fall back to defaults
    }
    this.migrate();
  }

  /**
   * Older saves stored the herd as plain species-id strings, and critters
   * from before the level system lack level/xp - spreading a fresh critter
   * under the saved fields fills any missing ones with defaults.
   */
  private migrate(): void {
    const herd = this.data.herd as unknown as (string | CritterInstance)[];
    this.data.herd = herd.map((entry) =>
      typeof entry === 'string' ? newCritter(entry) : { ...newCritter(entry.speciesId), ...entry }
    );
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // storage full/unavailable - non-fatal
    }
  }
}

export const gameState = new GameStateStore();
