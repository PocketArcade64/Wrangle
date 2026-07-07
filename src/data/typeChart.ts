/**
 * Type effectiveness chart for the 13 types currently in creatures.csv.
 * CHART[attacker][defender] = multiplier (0 immune, 0.5 resist, 2 super).
 * Missing entries = 1x. Dual types multiply.
 */
const CHART: Record<string, Record<string, number>> = {
  Normal: {},
  Fire: { Grass: 2, Ice: 2, Bug: 2, Fire: 0.5, Water: 0.5 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5 },
  Grass: { Water: 2, Fire: 0.5, Grass: 0.5, Poison: 0.5, Flying: 0.5, Bug: 0.5 },
  Electric: { Water: 2, Flying: 2, Electric: 0.5, Grass: 0.5 },
  Ice: { Grass: 2, Flying: 2, Fire: 0.5, Water: 0.5, Ice: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Dark: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Fairy: 0.5 },
  Poison: { Grass: 2, Fairy: 2, Poison: 0.5 },
  Flying: { Grass: 2, Fighting: 2, Bug: 2, Electric: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0 },
  Bug: { Grass: 2, Psychic: 2, Dark: 2, Fire: 0.5, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Fairy: 0.5 },
  Dark: { Psychic: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Fairy: { Fighting: 2, Dark: 2, Fire: 0.5, Poison: 0.5 }
};

export interface DefenseProfile {
  weak: string[];
  resist: string[];
  immune: string[];
}

/** Defensive matchups for a mono or dual type. */
export function defenseProfile(type1?: string, type2?: string): DefenseProfile {
  const weak: string[] = [];
  const resist: string[] = [];
  const immune: string[] = [];
  const defending = [type1, type2].filter((t): t is string => !!t);
  if (defending.length === 0) return { weak, resist, immune };

  for (const attacker of Object.keys(CHART)) {
    let mult = 1;
    for (const d of defending) mult *= CHART[attacker][d] ?? 1;
    if (mult === 0) immune.push(attacker);
    else if (mult >= 4) weak.push(`${attacker} x4`);
    else if (mult > 1) weak.push(attacker);
    else if (mult < 1) resist.push(attacker);
  }
  return { weak, resist, immune };
}
