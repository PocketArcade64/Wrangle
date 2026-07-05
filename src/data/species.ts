export type MovementPattern = 'graze' | 'flee' | 'charge';
export type AttackPattern = 'none' | 'radial';

export interface SpeciesDef {
  id: string;
  name: string;
  textureKey: string;
  bodyRadius: number;
  requiredLoops: number;
  /** Base walk speed, px/s. */
  moveSpeed: number;
  movement: MovementPattern;
  attack: AttackPattern;
  attackIntervalMs?: number;
  attackDamage?: number;
  telegraphMs?: number;
  ringMaxR?: number;
  ringSpeed?: number;
  /** Charge movers: seconds-ish interval between dashes (ms). */
  dashIntervalMs?: number;
  blurb: string;
}

/**
 * Placeholder test roster for the capture prototype. Real creatures
 * (custom pixel-art sprites) replace these later.
 */
export const SPECIES: SpeciesDef[] = [
  {
    id: 'bessie',
    name: 'BESSIE',
    textureKey: 'pl-cow',
    bodyRadius: 46,
    requiredLoops: 2,
    moveSpeed: 60,
    movement: 'graze',
    attack: 'none',
    blurb: 'A placid dairy cow. Slow and harmless.'
  },
  {
    id: 'pecksy',
    name: 'PECKSY',
    textureKey: 'pl-chicken',
    bodyRadius: 30,
    requiredLoops: 3,
    moveSpeed: 150,
    movement: 'flee',
    attack: 'none',
    blurb: 'A skittish hen. Fast, spooks easy.'
  },
  {
    id: 'dustdevil',
    name: 'DUSTDEVIL',
    textureKey: 'pl-dust',
    bodyRadius: 40,
    requiredLoops: 4,
    moveSpeed: 110,
    movement: 'charge',
    attack: 'radial',
    attackIntervalMs: 5000,
    attackDamage: 25,
    telegraphMs: 800,
    ringMaxR: 230,
    ringSpeed: 420,
    dashIntervalMs: 3500,
    blurb: 'A riled-up dust spirit. Charges and bursts.'
  }
];

export function speciesById(id: string): SpeciesDef {
  const s = SPECIES.find((sp) => sp.id === id);
  if (!s) throw new Error(`Unknown species id: ${id}`);
  return s;
}
