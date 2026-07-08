import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from './species';
import { EVOLUTIONS, EVOLVED_IDS } from './evolutions';
import { seededRng } from '../util/daily';

/**
 * Frontier Flats stage themes. A pin's map pixels decide the theme
 * (content-aware classification below); the theme decides palette, props
 * and which CSV types can spawn. Pools use CSV classic type names.
 */

export interface StageTheme {
  id: string;
  name: string;
  /** Preferred CSV types for the spawn pool. */
  types: string[];
  ground: number;
  groundDark: number;
  trail: number;
  /** Out-of-bounds terrain flanking the corridor + its inner edge trim. */
  wall: number;
  wallEdge: number;
  prop: 'grass' | 'flower' | 'reed' | 'tree' | 'rock' | 'fence';
  /** Environmental hazard flavor for the theme. */
  hazard: 'tumbleweed' | 'drop' | 'slick';
  /** Capture-arena backdrop when the lasso minigame fires mid-stage. */
  captureBg: number;
}

export const STAGE_THEMES: Record<string, StageTheme> = {
  prairie: {
    id: 'prairie',
    name: 'SUNNY PRAIRIE',
    types: ['Normal', 'Grass'],
    ground: 0xc9c25e,
    groundDark: 0xb0aa4c,
    trail: 0xb08d54,
    wall: 0x99923e,
    wallEdge: 0xb5ae52,
    prop: 'grass',
    hazard: 'tumbleweed',
    captureBg: 0xc9c25e
  },
  flower: {
    id: 'flower',
    name: 'FLOWER FIELDS',
    types: ['Grass', 'Bug'],
    ground: 0xa8c05a,
    groundDark: 0x92a94b,
    trail: 0xb08d54,
    wall: 0x5f8a3c,
    wallEdge: 0x79a44e,
    prop: 'flower',
    hazard: 'slick',
    captureBg: 0xa8c05a
  },
  water: {
    id: 'water',
    name: 'RIVER + PONDS',
    types: ['Water'],
    ground: 0x9db86a,
    groundDark: 0x86a458,
    trail: 0xa9895a,
    wall: 0x4f7ea0,
    wallEdge: 0x6f9cba,
    prop: 'reed',
    hazard: 'slick',
    captureBg: 0x7fa8c4
  },
  ranch: {
    id: 'ranch',
    name: 'WINDMILL RANCH',
    types: ['Normal'],
    ground: 0xc2b06a,
    groundDark: 0xab9a58,
    trail: 0xa9895a,
    wall: 0x7a5a34,
    wallEdge: 0x94714a,
    prop: 'fence',
    hazard: 'tumbleweed',
    captureBg: 0xc2b06a
  },
  grove: {
    id: 'grove',
    name: 'OAK GROVE',
    types: ['Grass'],
    ground: 0x7d9c4f,
    groundDark: 0x6a8842,
    trail: 0x96794c,
    wall: 0x46612f,
    wallEdge: 0x5a7a3e,
    prop: 'tree',
    hazard: 'drop',
    captureBg: 0x7d9c4f
  },
  creek: {
    id: 'creek',
    name: 'ROCKY CREEK',
    // Earth critters join this pool when the type reaches the CSV
    types: ['Water', 'Normal'],
    ground: 0xa8a08a,
    groundDark: 0x92897a,
    trail: 0x8d8272,
    wall: 0x6f6a5e,
    wallEdge: 0x8a8478,
    prop: 'rock',
    hazard: 'drop',
    captureBg: 0xa8a08a
  }
};

// ---------- content-aware map classification ----------

// Sample-count thresholds out of the 81-pixel block read around the tap.
// Tuned against the Frontier Flats art; adjust here if a region misreads.
const N_WATER = 30;
const N_CREEK_GRAY = 10;
const N_CREEK_BLUE = 6;
const N_ROCK_ALONE = 22;
const N_FLOWER = 8;
const N_RED_ROOF = 3;
const N_RANCH_BROWN = 32;
const N_GROVE = 24;

/**
 * Classify a tap on the map by majority vote over a 9x9 sample block
 * (step 6px, +/-24px). Single odd pixels (a blue flower petal) can't
 * flip the result - the surrounding region decides.
 */
export function classifyMapPoint(scene: Phaser.Scene, texKey: string, px: number, py: number): StageTheme {
  let blue = 0;
  let gray = 0;
  let flower = 0;
  let redRoof = 0;
  let brown = 0;
  let darkTree = 0;
  for (let dy = -24; dy <= 24; dy += 6) {
    for (let dx = -24; dx <= 24; dx += 6) {
      const x = Phaser.Math.Clamp(Math.round(px + dx), 0, 1023);
      const y = Phaser.Math.Clamp(Math.round(py + dy), 0, 1023);
      const c = scene.textures.getPixel(x, y, texKey);
      if (!c) continue;
      const { red: r, green: g, blue: b } = c;
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      if (b > 130 && b > r + 25 && b > g + 15) blue++;
      else if (maxc - minc < 28 && r > 90 && r < 215) gray++;
      else if (r > 150 && g < 95 && b < 95) redRoof++;
      else if ((r > 170 && g < 125 && b < 125) || (b > 120 && r > 105 && g < 110) || (r > 215 && g > 215 && b > 205)) flower++;
      else if (g > r + 14 && g < 150 && b < 100) darkTree++;
      else if (r > 110 && r < 215 && g > 65 && g < 155 && b < 95 && r > g + 25) brown++;
    }
  }
  if (gray >= N_CREEK_GRAY && blue >= N_CREEK_BLUE) return STAGE_THEMES.creek;
  if (blue >= N_WATER) return STAGE_THEMES.water;
  if (gray >= N_ROCK_ALONE) return STAGE_THEMES.creek;
  if (flower >= N_FLOWER) return STAGE_THEMES.flower;
  if (redRoof >= N_RED_ROOF || brown >= N_RANCH_BROWN) return STAGE_THEMES.ranch;
  if (darkTree >= N_GROVE) return STAGE_THEMES.grove;
  return STAGE_THEMES.prairie;
}

// ---------- stage generation ----------

export const STAGE_LENGTH = 3800;
/** Frontier Flats critter level band (shown on the map tab). */
export const FRONTIER_LEVELS = { min: 1, max: 5 };
/** Chance a group's center is the species' evolved form. */
const RARE_EVO_CHANCE = 0.12;

export interface StageGroup {
  y: number;
  speciesId: string;
  count: number;
  /** Rarer species standing in the group's center, when rolled. */
  rareId?: string;
  level: number;
}

export interface StageDef {
  seed: string;
  themeId: string;
  groups: StageGroup[];
  bossId: string;
  bossLevel: number;
}

/**
 * BASIC species (never an evolved form) whose type1/type2 fits the theme;
 * padded with random basics if the pool runs thin.
 */
function themePool(theme: StageTheme, rng: () => number): SpeciesDef[] {
  const basics = SPECIES.filter((sp) => !EVOLVED_IDS.has(sp.id));
  const pool = basics.filter((sp) => theme.types.includes(sp.type1 ?? '') || theme.types.includes(sp.type2 ?? ''));
  if (pool.length >= 3) return pool;
  const padded = [...pool];
  while (padded.length < 3 && padded.length < basics.length) {
    const sp = basics[Math.floor(rng() * basics.length)];
    if (!padded.includes(sp)) padded.push(sp);
  }
  return padded.length > 0 ? padded : SPECIES.slice(0, 3);
}

/**
 * Deterministic stage from a seed: same layout skeleton every time (spawn
 * groups along the trail, boss at the end), the seed picking species per
 * group, counts and levels. Groups are Rumble-style: a pack of one BASIC
 * species, with a small chance its EVOLVED form stands in the center.
 * Frontier Flats runs levels 1-4 with a level-5 boss.
 */
export function generateStage(seed: string, themeId: string): StageDef {
  const theme = STAGE_THEMES[themeId] ?? STAGE_THEMES.prairie;
  const rng = seededRng(seed);
  const pool = themePool(theme, rng);
  const pick = () => pool[Math.floor(rng() * pool.length)];

  const groupCount = 4 + Math.floor(rng() * 2); // 4-5 plus the boss
  const groups: StageGroup[] = [];
  for (let i = 0; i < groupCount; i++) {
    // evenly spaced up the trail, small seeded jitter
    const y = STAGE_LENGTH - 800 - i * ((STAGE_LENGTH - 1300) / groupCount) + Math.floor(rng() * 120 - 60);
    const sp = pick();
    const evo = EVOLUTIONS[sp.id];
    groups.push({
      y,
      speciesId: sp.id,
      count: 3 + Math.floor(rng() * 2),
      rareId: evo && rng() < RARE_EVO_CHANCE ? evo : undefined,
      level: FRONTIER_LEVELS.min + Math.floor(rng() * (FRONTIER_LEVELS.max - FRONTIER_LEVELS.min))
    });
  }
  const boss = pick();
  return { seed, themeId: theme.id, groups, bossId: boss.id, bossLevel: FRONTIER_LEVELS.max };
}
