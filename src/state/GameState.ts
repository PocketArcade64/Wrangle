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
  activeTeam: 0
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
    caughtAt: Date.now()
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

  /** Older saves stored the herd as plain species-id strings. */
  private migrate(): void {
    const herd = this.data.herd as unknown as (string | CritterInstance)[];
    this.data.herd = herd.map((entry) =>
      typeof entry === 'string' ? newCritter(entry) : entry
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
