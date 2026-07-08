/**
 * Wrangle's FULL 17-type effectiveness chart (user-authored, 2026-07-08),
 * keyed by the CANON western type names (the badge art names).
 * CHART[attacker][defender] = multiplier (0 immune, 0.5 resist, 2 super).
 * Missing entries = 1x. Dual types multiply.
 *
 * Reconciliation notes from the user's spreadsheet (attack columns +
 * defensive Vulnerable/Immune columns cross-checked):
 * - Earth deals 2x to Air and Frost deals 2x to Bug: present only in the
 *   defensive "vulnerable to" columns, honored here.
 * - "Fire vulnerable to ... Fire" conflicted with Fire resisting Fire in
 *   its own attack column; resolved as Fire resists Fire (0.5x).
 * - Dragon listed in both Dragon's strong AND weak columns; resolved as
 *   2x (Dragon's vulnerable column also lists Dragon).
 */
const CHART: Record<string, Record<string, number>> = {
  Normal: { Ghost: 0 },
  Fire: { Grass: 2, Frost: 2, Metal: 2, Bug: 2, Fire: 0.5, Water: 0.5, Earth: 0.5, Dragon: 0.5 },
  Water: { Fire: 2, Earth: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
  Grass: {
    Water: 2,
    Earth: 2,
    Fire: 0.5,
    Grass: 0.5,
    Frost: 0.5,
    Poison: 0.5,
    Bug: 0.5,
    Metal: 0.5,
    Dragon: 0.5,
    Air: 0.5
  },
  Lightning: { Water: 2, Air: 2, Grass: 0.5, Lightning: 0.5, Dragon: 0.5, Earth: 0 },
  Frost: { Grass: 2, Earth: 2, Air: 2, Dragon: 2, Bug: 2, Fire: 0.5, Water: 0.5, Frost: 0.5, Metal: 0.5 },
  Earth: { Fire: 2, Lightning: 2, Poison: 2, Metal: 2, Air: 2, Grass: 0.5, Bug: 0.5 },
  Air: { Grass: 2, Fighting: 2, Bug: 2, Lightning: 0.5, Metal: 0.5 },
  Fighting: {
    Normal: 2,
    Frost: 2,
    Earth: 2,
    Metal: 2,
    Dark: 2,
    Air: 0.5,
    Psychic: 0.5,
    Mystical: 0.5,
    Bug: 0.5,
    Ghost: 0
  },
  Poison: { Grass: 2, Mystical: 2, Poison: 0.5, Earth: 0.5, Ghost: 0.5, Fire: 0.5, Metal: 0 },
  Bug: {
    Grass: 2,
    Psychic: 2,
    Dark: 2,
    Fire: 0.5,
    Fighting: 0.5,
    Poison: 0.5,
    Frost: 0.5,
    Ghost: 0.5,
    Air: 0.5,
    Metal: 0.5
  },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Metal: 0.5, Dark: 0 },
  Ghost: { Psychic: 2, Ghost: 2, Dark: 0.5, Normal: 0 },
  Dark: { Psychic: 2, Ghost: 2, Dark: 0.5, Fighting: 0.5, Mystical: 0.5 },
  Metal: { Frost: 2, Mystical: 2, Earth: 2, Fire: 0.5, Water: 0.5, Lightning: 0.5, Metal: 0.5 },
  Mystical: { Fighting: 2, Dragon: 2, Dark: 2, Fire: 0.5, Poison: 0.5, Metal: 0.5 },
  Dragon: { Dragon: 2, Frost: 0.5, Mystical: 0 }
};

/** Display order for the quick-view chart (same order as CHART above). */
export const ALL_TYPES = Object.keys(CHART);

/**
 * Wrangle's western type names (the badge art in public/sprites/types/ is
 * canon). The CSV still uses classic names for the original 13 types;
 * map at display/lookup time. New types (Earth, Metal, Ghost, Dragon)
 * already use canon names everywhere.
 */
const BADGE_NAME: Record<string, string> = {
  Flying: 'Air',
  Ice: 'Frost',
  Electric: 'Lightning',
  Fairy: 'Mystical'
};

/** Display/badge name for a CSV type name. */
export function badgeName(csvType: string): string {
  return BADGE_NAME[csvType] ?? csvType;
}

/** All badge file base names (public/sprites/types/<name>_46x15.png). */
export const TYPE_BADGES = [
  'Air',
  'Bug',
  'Dark',
  'Dragon',
  'Earth',
  'Fighting',
  'Fire',
  'Frost',
  'Ghost',
  'Grass',
  'Lightning',
  'Metal',
  'Mystical',
  'Normal',
  'Poison',
  'Psychic',
  'Water'
];

export interface DefenseProfile {
  weak: string[];
  resist: string[];
  immune: string[];
}

/**
 * Defensive matchups for a mono or dual type. Accepts CSV or canon names;
 * returns canon (badge) names.
 */
export function defenseProfile(type1?: string, type2?: string): DefenseProfile {
  const weak: string[] = [];
  const resist: string[] = [];
  const immune: string[] = [];
  const defending = [type1, type2].filter((t): t is string => !!t).map(badgeName);
  if (defending.length === 0) return { weak, resist, immune };

  for (const attacker of ALL_TYPES) {
    let mult = 1;
    for (const d of defending) mult *= CHART[attacker][d] ?? 1;
    if (mult === 0) immune.push(attacker);
    else if (mult >= 4) weak.push(`${attacker} x4`);
    else if (mult > 1) weak.push(attacker);
    else if (mult < 1) resist.push(attacker);
  }
  return { weak, resist, immune };
}

export interface OffenseProfile {
  strong: string[];
  weak: string[];
  none: string[];
}

/** Attacking matchups for one canon-named type (quick-view chart rows). */
export function offenseProfile(canonType: string): OffenseProfile {
  const row = CHART[canonType] ?? {};
  const strong: string[] = [];
  const weak: string[] = [];
  const none: string[] = [];
  for (const [defender, mult] of Object.entries(row)) {
    if (mult === 0) none.push(defender);
    else if (mult > 1) strong.push(defender);
    else weak.push(defender);
  }
  return { strong, weak, none };
}
