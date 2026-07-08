import { SpeciesDef } from '../data/species';
import { badgeName } from '../data/typeChart';

/**
 * Battle move definitions - drop 1 implements 6 types (Fire, Water, Grass,
 * Lightning, Air, Normal), one physical + one special each, every hitbox
 * shape mechanically distinct. Types without moves yet borrow Normal's so
 * every critter is playable; drop 2 fills in the other 11 types.
 */

export type MoveBehavior =
  | 'arc' // Burning Lash - short whip arc in front
  | 'lobPatch' // Wildfire Lob - arcing lob, burning ground patch
  | 'conePush' // Riptide Slam - melee cone, knockback only
  | 'wave' // Flash Flood - slow tall wave wall, soaks
  | 'tether' // Bramble Lasso - thin line, roots first target
  | 'lobBurst' // Bloomburst - arcing lob, radial detonation
  | 'jabChain' // Live Wire Jab - point-blank poke + one chain arc
  | 'beam' // Overcharge Bolt - telegraphed full-length line
  | 'dashLine' // Talon Dive - user dashes, body is the hitbox
  | 'coneKnock' // Gale Herd - short wide cone, group knockback
  | 'wideArc' // Roundup Tackle - forgiving wide melee arc
  | 'radialDebuff'; // Echoing Holler - self-centered burst, lowers attack

export interface MoveDef {
  id: string;
  name: string;
  /** Canon (badge) type name - drives effectiveness + badge art. */
  type: string;
  kind: 'physical' | 'special';
  power: number;
  cooldownS: number;
  behavior: MoveBehavior;
  /** Behavior tuning - only the fields the behavior reads. */
  range: number;
  burnS?: number;
  patchS?: number;
  knockback?: number;
  soakS?: number;
  rootS?: number;
  burstR?: number;
  telegraphS?: number;
  dashLen?: number;
  atkDownS?: number;
}

export const MOVES: Record<string, MoveDef> = {
  'Fire-physical': {
    id: 'Fire-physical',
    name: 'BURNING LASH',
    type: 'Fire',
    kind: 'physical',
    power: 40,
    cooldownS: 2.4,
    behavior: 'arc',
    range: 120,
    burnS: 4
  },
  'Fire-special': {
    id: 'Fire-special',
    name: 'WILDFIRE LOB',
    type: 'Fire',
    kind: 'special',
    power: 30,
    cooldownS: 5,
    behavior: 'lobPatch',
    range: 360,
    patchS: 3
  },
  'Water-physical': {
    id: 'Water-physical',
    name: 'RIPTIDE SLAM',
    type: 'Water',
    kind: 'physical',
    power: 25,
    cooldownS: 3,
    behavior: 'conePush',
    range: 140,
    knockback: 150
  },
  'Water-special': {
    id: 'Water-special',
    name: 'FLASH FLOOD',
    type: 'Water',
    kind: 'special',
    power: 35,
    cooldownS: 6,
    behavior: 'wave',
    range: 520,
    soakS: 4
  },
  'Grass-physical': {
    id: 'Grass-physical',
    name: 'BRAMBLE LASSO',
    type: 'Grass',
    kind: 'physical',
    power: 18,
    cooldownS: 4,
    behavior: 'tether',
    range: 420,
    rootS: 1.5
  },
  'Grass-special': {
    id: 'Grass-special',
    name: 'BLOOMBURST',
    type: 'Grass',
    kind: 'special',
    power: 55,
    cooldownS: 6,
    behavior: 'lobBurst',
    range: 360,
    burstR: 110
  },
  'Lightning-physical': {
    id: 'Lightning-physical',
    name: 'LIVE WIRE JAB',
    type: 'Lightning',
    kind: 'physical',
    power: 30,
    cooldownS: 2,
    behavior: 'jabChain',
    range: 100
  },
  'Lightning-special': {
    id: 'Lightning-special',
    name: 'OVERCHARGE BOLT',
    type: 'Lightning',
    kind: 'special',
    power: 60,
    cooldownS: 6,
    behavior: 'beam',
    range: 900,
    telegraphS: 0.45
  },
  'Air-physical': {
    id: 'Air-physical',
    name: 'TALON DIVE',
    type: 'Air',
    kind: 'physical',
    power: 45,
    cooldownS: 4.5,
    behavior: 'dashLine',
    range: 260,
    dashLen: 260
  },
  'Air-special': {
    id: 'Air-special',
    name: 'GALE HERD',
    type: 'Air',
    kind: 'special',
    power: 30,
    cooldownS: 4,
    behavior: 'coneKnock',
    range: 160,
    knockback: 130
  },
  'Normal-physical': {
    id: 'Normal-physical',
    name: 'ROUNDUP TACKLE',
    type: 'Normal',
    kind: 'physical',
    power: 35,
    cooldownS: 1.8,
    behavior: 'wideArc',
    range: 130
  },
  'Normal-special': {
    id: 'Normal-special',
    name: 'ECHOING HOLLER',
    type: 'Normal',
    kind: 'special',
    power: 25,
    cooldownS: 5,
    behavior: 'radialDebuff',
    range: 150,
    atkDownS: 4
  }
};

/**
 * A critter's loadout: its attack style's move for each of its types
 * (1 button single-type, 2 dual). Types not yet implemented fall back to
 * the Normal move of the same style.
 */
export function movesForSpecies(sp: SpeciesDef): MoveDef[] {
  const style = sp.atkStyle ?? 'physical';
  const types = [sp.type1, sp.type2].filter((t): t is string => !!t).map(badgeName);
  if (types.length === 0) types.push('Normal');
  const out: MoveDef[] = [];
  for (const t of types) {
    const move = MOVES[`${t}-${style}`] ?? MOVES[`Normal-${style}`];
    if (!out.some((m) => m.id === move.id)) out.push(move);
  }
  return out;
}
