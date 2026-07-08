import { SpeciesDef } from '../data/species';
import { CritterInstance, Pedigree, xpForNextLevel } from '../state/GameState';

export const LEVEL_CAP = 100;
/** CSV base stats are blank until balancing - same provisional the UI uses. */
const PROVISIONAL_BASE = 50;

export interface BattleStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

function statAt(base: number | undefined, ped: number, level: number, isHp: boolean): number {
  const b = base ?? PROVISIONAL_BASE;
  const core = Math.floor(((2 * b + ped) * level) / 100);
  return isHp ? core + level + 10 : core + 5;
}

export function battleStats(sp: SpeciesDef, pedigree: Pedigree, level: number): BattleStats {
  return {
    hp: statAt(sp.hp, pedigree.hp, level, true),
    atk: statAt(sp.attack, pedigree.atk, level, false),
    def: statAt(sp.defense, pedigree.def, level, false),
    spa: statAt(sp.spAttack, pedigree.spa, level, false),
    spd: statAt(sp.spDefense, pedigree.spd, level, false),
    spe: statAt(sp.speed, pedigree.spe, level, false)
  };
}

const WILD_PEDIGREE: Pedigree = { hp: 8, atk: 8, def: 8, spa: 8, spd: 8, spe: 8 };

export function wildStats(sp: SpeciesDef, level: number): BattleStats {
  return battleStats(sp, WILD_PEDIGREE, level);
}

/** Pokemon-flavored damage roll; mult carries type effectiveness etc. */
export function damageRoll(level: number, power: number, atk: number, def: number, mult: number): number {
  const base = Math.floor(((((2 * level) / 5 + 2) * power * atk) / Math.max(1, def)) / 50) + 2;
  const varied = base * (0.9 + Math.random() * 0.2) * mult;
  return Math.max(1, Math.round(varied));
}

export function xpFromKill(enemyLevel: number, isBoss: boolean): number {
  return (18 + enemyLevel * 6) * (isBoss ? 3 : 1);
}

/** Grants XP (capped at level 100); returns how many levels were gained. */
export function applyXp(inst: CritterInstance, amount: number): number {
  if (inst.level >= LEVEL_CAP) {
    inst.xp = 0;
    return 0;
  }
  inst.xp += amount;
  let gained = 0;
  while (inst.level < LEVEL_CAP && inst.xp >= xpForNextLevel(inst.level)) {
    inst.xp -= xpForNextLevel(inst.level);
    inst.level++;
    gained++;
  }
  if (inst.level >= LEVEL_CAP) inst.xp = 0;
  return gained;
}
