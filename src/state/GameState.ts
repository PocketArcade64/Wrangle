export interface WrangleSave {
  currency: number;
  stamina: number;
  staminaMax: number;
  dailyAvailable: boolean;
  leadCreatureId: string;
  biome: string;
  /** Species ids of wrangled critters, in capture order (dupes allowed). */
  herd: string[];
}

const KEY = 'wrangle-save-v1';

const DEFAULTS: WrangleSave = {
  currency: 250,
  stamina: 4,
  staminaMax: 4,
  dailyAvailable: true,
  leadCreatureId: 'herbifuzz',
  biome: 'DUSTY FLATS',
  herd: []
};

/**
 * Minimal persistent player state (localStorage). Grows into the full save
 * system (owned creatures, teams, locations) in M6; keep all reads/writes
 * going through this module so that swap is one-file.
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
