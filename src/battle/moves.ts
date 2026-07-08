import { SpeciesDef } from '../data/species';
import { badgeName } from '../data/typeChart';

/**
 * The full battle move roster: all 17 types, one physical + one special
 * each, every hitbox shape mechanically distinct. Shared melee strikes use
 * the generic 'melee' behavior with effect fields; unique shapes get their
 * own behavior id (implemented in StageScene.useMove).
 */

export type MoveBehavior =
  | 'melee' // cone strike; effect fields decide the payload
  | 'arc' // Burning Lash - whip arc + burn
  | 'lobPatch' // Wildfire Lob - lob -> burning ground patch
  | 'conePush' // Riptide Slam - melee cone, knockback only
  | 'wave' // Flash Flood - traveling wave wall, soaks
  | 'tether' // Bramble Lasso - thin line, roots first target
  | 'lobBurst' // Bloomburst - lob -> radial detonation
  | 'jabChain' // Live Wire Jab - poke + one chain arc
  | 'beam' // Overcharge Bolt - telegraphed full-length line
  | 'dashLine' // Talon Dive - user dashes, body is the hitbox
  | 'coneKnock' // Gale Herd - short wide cone, group knockback
  | 'radialDebuff' // Echoing Holler - self burst, lowers attack
  | 'selfCircle' // Canyon Crush - slam around the user, long recovery
  | 'expandCone' // Dust Reckoning - wide dust cone, lowers accuracy
  | 'blink' // Shadow Bounty - teleport-strike behind the target
  | 'fanOrbs' // Farsight Pulse - three orbs in a fixed fan
  | 'phase360' // Grave Grapple - short strike, any direction, phases
  | 'curseOrb' // Wailing Curse - slow orb attaches a delayed curse
  | 'pellets' // Shrapnel Volley - short-range pellet spread
  | 'homingStar' // Lucky Star Waltz - gentle homing, high crit
  | 'trackingRoar' // Focused Roar - hard-tracking line shot
  | 'cloudSelf' // Toxic Bloomcloud - stationary poison cloud at self
  | 'swarmBurst' // Swarmcall - self burst scaling with Bug allies
  | 'veil' // Blizzard Veil - zero damage: slow foes, haste self
  | 'channelBeam'; // Draconic Surge - hold to widen/extend the beam

export interface MoveDef {
  id: string;
  name: string;
  /** Canon (badge) type name - drives effectiveness + badge art. */
  type: string;
  kind: 'physical' | 'special';
  power: number;
  cooldownS: number;
  behavior: MoveBehavior;
  range: number;
  /** Cone half-angle for melee-family hitboxes (radians). */
  spread?: number;
  /** Melee strikes hit only the nearest target unless aoe is set. */
  aoe?: boolean;
  burnS?: number;
  poisonS?: number;
  patchS?: number;
  cloudS?: number;
  knockback?: number;
  soakS?: number;
  rootS?: number;
  burstR?: number;
  telegraphS?: number;
  dashLen?: number;
  atkDownS?: number;
  accDownS?: number;
  /** Stun/freeze duration (seconds) applied on hit. */
  stunS?: number;
  scrambleS?: number;
  charmS?: number;
  /** Probability gate for chance-based effects (stun/charm/scramble). */
  chance?: number;
  /** Damage multiplier when striking a target's back (Dark physical). */
  backBonus?: number;
  /** Self buffs / self costs. */
  shieldS?: number;
  hasteS?: number;
  slowS?: number;
  selfStunS?: number;
  /** Multi-hit count (same spot, back to back). */
  hits?: number;
  /** Projectile tuning. */
  projSpeed?: number;
  orbCount?: number;
  homing?: number;
  critChance?: number;
  critMult?: number;
  curseDelayS?: number;
  /** Swarmcall: bonus multiplier per other Bug ally on the team. */
  allyBonus?: number;
  channelMaxS?: number;
}

const M = (def: MoveDef): MoveDef => def;

export const MOVES: Record<string, MoveDef> = {
  'Fire-physical': M({
    id: 'Fire-physical', name: 'BURNING LASH', type: 'Fire', kind: 'physical',
    power: 40, cooldownS: 2.4, behavior: 'arc', range: 120, spread: 1.1, burnS: 4
  }),
  'Fire-special': M({
    id: 'Fire-special', name: 'WILDFIRE LOB', type: 'Fire', kind: 'special',
    power: 30, cooldownS: 5, behavior: 'lobPatch', range: 360, patchS: 3
  }),
  'Water-physical': M({
    id: 'Water-physical', name: 'RIPTIDE SLAM', type: 'Water', kind: 'physical',
    power: 25, cooldownS: 3, behavior: 'conePush', range: 140, spread: 0.8, knockback: 150
  }),
  'Water-special': M({
    id: 'Water-special', name: 'FLASH FLOOD', type: 'Water', kind: 'special',
    power: 35, cooldownS: 6, behavior: 'wave', range: 520, soakS: 4
  }),
  'Grass-physical': M({
    id: 'Grass-physical', name: 'BRAMBLE LASSO', type: 'Grass', kind: 'physical',
    power: 18, cooldownS: 4, behavior: 'tether', range: 420, rootS: 1.5
  }),
  'Grass-special': M({
    id: 'Grass-special', name: 'BLOOMBURST', type: 'Grass', kind: 'special',
    power: 55, cooldownS: 6, behavior: 'lobBurst', range: 360, burstR: 110
  }),
  'Lightning-physical': M({
    id: 'Lightning-physical', name: 'LIVE WIRE JAB', type: 'Lightning', kind: 'physical',
    power: 30, cooldownS: 2, behavior: 'jabChain', range: 100, spread: 0.9
  }),
  'Lightning-special': M({
    id: 'Lightning-special', name: 'OVERCHARGE BOLT', type: 'Lightning', kind: 'special',
    power: 60, cooldownS: 6, behavior: 'beam', range: 900, telegraphS: 0.45
  }),
  'Earth-physical': M({
    id: 'Earth-physical', name: 'CANYON CRUSH', type: 'Earth', kind: 'physical',
    power: 50, cooldownS: 5, behavior: 'selfCircle', range: 150, selfStunS: 0.8
  }),
  'Earth-special': M({
    id: 'Earth-special', name: 'DUST RECKONING', type: 'Earth', kind: 'special',
    power: 10, cooldownS: 5, behavior: 'expandCone', range: 320, spread: 0.9, accDownS: 4
  }),
  'Air-physical': M({
    id: 'Air-physical', name: 'TALON DIVE', type: 'Air', kind: 'physical',
    power: 45, cooldownS: 4.5, behavior: 'dashLine', range: 260, dashLen: 260
  }),
  'Air-special': M({
    id: 'Air-special', name: 'GALE HERD', type: 'Air', kind: 'special',
    power: 30, cooldownS: 4, behavior: 'coneKnock', range: 160, spread: 1.25, knockback: 130
  }),
  'Dark-physical': M({
    id: 'Dark-physical', name: 'BACKALLEY BITE', type: 'Dark', kind: 'physical',
    power: 35, cooldownS: 2.6, behavior: 'melee', range: 100, spread: 0.9, backBonus: 1.6
  }),
  'Dark-special': M({
    id: 'Dark-special', name: 'SHADOW BOUNTY', type: 'Dark', kind: 'special',
    power: 55, cooldownS: 7, behavior: 'blink', range: 500, selfStunS: 0.5
  }),
  'Psychic-physical': M({
    id: 'Psychic-physical', name: 'MINDSPUR STRIKE', type: 'Psychic', kind: 'physical',
    power: 32, cooldownS: 2.4, behavior: 'melee', range: 100, spread: 0.55, scrambleS: 1, chance: 0.5
  }),
  'Psychic-special': M({
    id: 'Psychic-special', name: 'FARSIGHT PULSE', type: 'Psychic', kind: 'special',
    power: 16, cooldownS: 3.5, behavior: 'fanOrbs', range: 520, orbCount: 3, projSpeed: 320
  }),
  'Ghost-physical': M({
    id: 'Ghost-physical', name: 'GRAVE GRAPPLE', type: 'Ghost', kind: 'physical',
    power: 40, cooldownS: 3, behavior: 'phase360', range: 110
  }),
  'Ghost-special': M({
    id: 'Ghost-special', name: 'WAILING CURSE', type: 'Ghost', kind: 'special',
    power: 60, cooldownS: 6.5, behavior: 'curseOrb', range: 600, projSpeed: 120, homing: 0.8, curseDelayS: 3
  }),
  'Metal-physical': M({
    id: 'Metal-physical', name: 'RIVET RAM', type: 'Metal', kind: 'physical',
    power: 24, cooldownS: 2.6, behavior: 'melee', range: 110, spread: 0.7, shieldS: 2.5
  }),
  'Metal-special': M({
    id: 'Metal-special', name: 'SHRAPNEL VOLLEY', type: 'Metal', kind: 'special',
    power: 14, cooldownS: 4, behavior: 'pellets', range: 260, orbCount: 5, projSpeed: 380
  }),
  'Mystical-physical': M({
    id: 'Mystical-physical', name: 'CHARMSPUR KICK', type: 'Mystical', kind: 'physical',
    power: 30, cooldownS: 2.8, behavior: 'melee', range: 110, spread: 0.8, charmS: 2.5, chance: 0.5
  }),
  'Mystical-special': M({
    id: 'Mystical-special', name: 'LUCKY STAR WALTZ', type: 'Mystical', kind: 'special',
    power: 34, cooldownS: 4.5, behavior: 'homingStar', range: 700, projSpeed: 190, homing: 2.2,
    critChance: 0.3, critMult: 1.7
  }),
  'Normal-physical': M({
    id: 'Normal-physical', name: 'ROUNDUP TACKLE', type: 'Normal', kind: 'physical',
    power: 35, cooldownS: 1.8, behavior: 'melee', range: 130, spread: 1.4, aoe: true
  }),
  'Normal-special': M({
    id: 'Normal-special', name: 'ECHOING HOLLER', type: 'Normal', kind: 'special',
    power: 25, cooldownS: 5, behavior: 'radialDebuff', range: 150, atkDownS: 4
  }),
  'Fighting-physical': M({
    id: 'Fighting-physical', name: 'IRON GRIP TOSS', type: 'Fighting', kind: 'physical',
    power: 45, cooldownS: 4, behavior: 'melee', range: 62, spread: 1.2, stunS: 1.2
  }),
  'Fighting-special': M({
    id: 'Fighting-special', name: 'FOCUSED ROAR', type: 'Fighting', kind: 'special',
    power: 55, cooldownS: 8, behavior: 'trackingRoar', range: 900, projSpeed: 430, homing: 4.5
  }),
  'Poison-physical': M({
    id: 'Poison-physical', name: 'VENOM SPUR KICK', type: 'Poison', kind: 'physical',
    power: 30, cooldownS: 2.4, behavior: 'melee', range: 105, spread: 0.8, poisonS: 6
  }),
  'Poison-special': M({
    id: 'Poison-special', name: 'TOXIC BLOOMCLOUD', type: 'Poison', kind: 'special',
    power: 20, cooldownS: 6, behavior: 'cloudSelf', range: 110, cloudS: 4
  }),
  'Bug-physical': M({
    id: 'Bug-physical', name: 'PINCER RUSH', type: 'Bug', kind: 'physical',
    power: 20, cooldownS: 2.2, behavior: 'melee', range: 100, spread: 0.8, hits: 2
  }),
  'Bug-special': M({
    id: 'Bug-special', name: 'SWARMCALL', type: 'Bug', kind: 'special',
    power: 18, cooldownS: 4.5, behavior: 'swarmBurst', range: 150, allyBonus: 0.5
  }),
  'Frost-physical': M({
    id: 'Frost-physical', name: 'PERMAFROST FANG', type: 'Frost', kind: 'physical',
    power: 30, cooldownS: 2.6, behavior: 'melee', range: 100, spread: 0.8, stunS: 1, chance: 0.35
  }),
  'Frost-special': M({
    id: 'Frost-special', name: 'BLIZZARD VEIL', type: 'Frost', kind: 'special',
    power: 0, cooldownS: 7, behavior: 'veil', range: 170, slowS: 3, hasteS: 3
  }),
  'Dragon-physical': M({
    id: 'Dragon-physical', name: 'RIDGEBACK SLAM', type: 'Dragon', kind: 'physical',
    power: 75, cooldownS: 7, behavior: 'melee', range: 150, spread: 1.2, aoe: true
  }),
  'Dragon-special': M({
    id: 'Dragon-special', name: 'DRACONIC SURGE', type: 'Dragon', kind: 'special',
    power: 40, cooldownS: 7, behavior: 'channelBeam', range: 900, channelMaxS: 1.2
  })
};

/**
 * A critter's loadout: its attack style's move for each of its types
 * (1 button single-type, 2 dual). Unknown type names fall back to the
 * Normal move of the same style.
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
