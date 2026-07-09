import { evoStage } from './evolutions';
import { seededRng } from '../util/daily';

/**
 * Generated base stats for critters whose CSV columns are blank (which is
 * most of them until balancing). Pokemon-INSPIRED trends without copying
 * any real spread:
 *  - stat totals rise by evolution stage (~320 basic / ~420 mid / ~525
 *    final, plus a little per-species character)
 *  - the attack style leans the offensive stat (physical -> ATK,
 *    special -> SPA)
 *  - capture behavior shapes the body: fleers are fast and frail,
 *    chargers are slow bruisers, grazers are hardy
 *  - each type nudges its stereotype (Bugs quick and papery, Poison
 *    tough-shelled, Psychic sharp special, etc.)
 * Everything is DETERMINISTIC per species id (seeded), so every device
 * agrees. A filled CSV cell always overrides the generated value.
 */

/** Stat totals by evolution stage - THE power-curve tuning knob. */
const STAGE_TOTALS = [320, 420, 525];

export interface BaseSpread {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

/** CSV (classic) type name -> stereotype nudges. */
const TYPE_LEAN: Record<string, Partial<BaseSpread>> = {
  Normal: { hp: 0.2 },
  Grass: { hp: 0.15, spAttack: 0.1 },
  Fire: { attack: 0.15, speed: 0.15 },
  Water: { spDefense: 0.2, hp: 0.1 },
  Electric: { speed: 0.3 },
  Bug: { speed: 0.2, hp: -0.15 },
  Poison: { defense: 0.25 },
  Psychic: { spAttack: 0.25, speed: 0.1 },
  Fairy: { spDefense: 0.25 },
  Dark: { attack: 0.2 },
  Ice: { defense: 0.15, spDefense: 0.1 },
  Flying: { speed: 0.25 },
  Fighting: { attack: 0.3, spDefense: -0.1 },
  Ghost: { spAttack: 0.2, defense: 0.1 },
  Ground: { defense: 0.2, attack: 0.15, speed: -0.15 },
  Rock: { defense: 0.3, speed: -0.2 },
  Dragon: { attack: 0.2, spAttack: 0.15 },
  Steel: { defense: 0.35, speed: -0.2 }
};

export function generateBaseStats(
  id: string,
  type1: string | undefined,
  type2: string | undefined,
  movement: 'graze' | 'flee' | 'charge',
  atkStyle: 'physical' | 'special' | undefined
): BaseSpread {
  const rng = seededRng(`base-${id}`);
  const stage = evoStage(id);
  const total = STAGE_TOTALS[stage] + Math.round((rng() - 0.5) * 30);

  const w: BaseSpread = { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 };
  const bump = (lean: Partial<BaseSpread>) => {
    for (const k of Object.keys(lean) as (keyof BaseSpread)[]) w[k] += lean[k] ?? 0;
  };

  // offensive lean by attack style (special types default to special)
  const style =
    atkStyle ?? (['Psychic', 'Fairy', 'Electric', 'Ghost'].includes(type1 ?? '') ? 'special' : 'physical');
  bump(style === 'physical' ? { attack: 0.55, spAttack: -0.3 } : { spAttack: 0.55, attack: -0.3 });

  // body shape from capture behavior
  if (movement === 'flee') bump({ speed: 0.5, defense: -0.2, hp: -0.1 });
  else if (movement === 'charge') bump({ attack: 0.25, hp: 0.3, speed: -0.25 });
  else bump({ hp: 0.25, defense: 0.2, speed: -0.1 });

  for (const t of [type1, type2]) {
    if (t && TYPE_LEAN[t]) bump(TYPE_LEAN[t]);
  }

  // a pinch of per-species character so no two spreads read identical
  for (const k of Object.keys(w) as (keyof BaseSpread)[]) {
    w[k] = Math.max(0.35, w[k] + (rng() - 0.5) * 0.16);
  }

  const sum = w.hp + w.attack + w.defense + w.spAttack + w.spDefense + w.speed;
  const stat = (k: keyof BaseSpread, min: number) => Math.max(min, Math.round((total * w[k]) / sum));
  return {
    hp: stat('hp', 30),
    attack: stat('attack', 22),
    defense: stat('defense', 22),
    spAttack: stat('spAttack', 22),
    spDefense: stat('spDefense', 22),
    speed: stat('speed', 22)
  };
}
