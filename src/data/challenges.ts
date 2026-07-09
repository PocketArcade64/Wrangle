import { SpeciesDef } from './species';
import { EVOLVED_IDS } from './evolutions';
import { STAGE_THEMES, themeSpeciesPool } from './stages';
import { badgeName } from './typeChart';
import { dateKey, seededRng } from '../util/daily';

/**
 * The daily-challenge pool for the bounty board. Challenges are generated
 * from templates against what the player can ACTUALLY find (the union of
 * every unlocked theme's species pool), so nothing impossible is ever
 * posted: no Fire-type challenges while no unlocked map spawns Fire. As
 * new maps/areas unlock, the pool grows on its own.
 *
 * NO species-specific challenges here by design - hunting one particular
 * critter is the posters' and roundup contracts' job on the upper board.
 * This section stays gameplay/stage flavored.
 *
 * Current pool size with the Frontier Flats data: ~67 challenges
 * (4 any-catch + 12 type-catch + 4 stage + 2 region + 18 themed clears +
 * 3 full-posse + 6 mono-type + 3 knockout + 3 boss + 3 level-up +
 * 3 gold + 2 clean-rope + 2 turn-in + rare + boss-lasso).
 *
 * Every `stat` key is a gameState.quests() day tally bumped by gameplay:
 *   CaptureScene: catches, catchType_<T>, rareCatch, bossCatch,
 *                 cleanCatch, goldEarned
 *   StageScene:   stages, flats, clearTheme_<id>, fullPosse,
 *                 monoClear_<T>, kos, bosses, levelUps, goldEarned
 *   BountiesScene: turnInCount
 */
export interface ChallengeDef {
  id: string;
  /** gameState.quests().stats key that tracks this challenge. */
  stat: string;
  label: string;
  need: number;
  reward: number;
  /** Template family - the daily pick caps 2 per family for variety. */
  family: string;
}

/** How many challenges the board posts each day. */
export const CHALLENGES_PER_DAY = 6;

/** Everything findable across the unlocked maps' theme pools. */
function findableSpecies(): SpeciesDef[] {
  const out: SpeciesDef[] = [];
  for (const id of Object.keys(STAGE_THEMES)) {
    for (const sp of themeSpeciesPool(id)) {
      if (!out.includes(sp)) out.push(sp);
    }
  }
  return out;
}

/** The full eligible pool for today (only completable challenges). */
export function challengePool(): ChallengeDef[] {
  const pool: ChallengeDef[] = [];
  const basics = findableSpecies().filter((sp) => !EVOLVED_IDS.has(sp.id));

  // findable-BASIC count per CSV type (rare evolved forms are too chancy
  // to hang a type/species challenge on - they get their own one-off)
  const typeCounts = new Map<string, number>();
  for (const sp of basics) {
    for (const t of [sp.type1, sp.type2]) {
      if (t) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
  }
  const types = [...typeCounts.keys()].sort();

  // 1) plain wrangling
  ([
    [3, 40],
    [5, 60],
    [8, 95],
    [12, 140]
  ] as const).forEach(([need, reward]) =>
    pool.push({ id: `catch${need}`, stat: 'catches', label: `WRANGLE ANY ${need} CRITTERS`, need, reward, family: 'catch' })
  );

  // 2) type wrangling - only types a findable basic actually carries
  for (const t of types) {
    const shown = badgeName(t).toUpperCase();
    pool.push({
      id: `ctype-${t}-2`,
      stat: `catchType_${t}`,
      label: `WRANGLE 2 ${shown}-TYPE CRITTERS`,
      need: 2,
      reward: 55,
      family: 'ctype'
    });
    pool.push({
      id: `ctype-${t}-4`,
      stat: `catchType_${t}`,
      label: `WRANGLE 4 ${shown}-TYPE CRITTERS`,
      need: 4,
      reward: 95,
      family: 'ctype'
    });
  }

  // 3) stage clears
  ([
    [2, 40],
    [3, 60],
    [5, 90],
    [10, 160]
  ] as const).forEach(([need, reward]) =>
    pool.push({ id: `stage${need}`, stat: 'stages', label: `CLEAR ${need} STAGES`, need, reward, family: 'stage' })
  );

  // 4) region clears (this map IS Frontier Flats)
  ([
    [2, 50],
    [4, 90]
  ] as const).forEach(([need, reward]) =>
    pool.push({ id: `flats${need}`, stat: 'flats', label: `CLEAR ${need} FRONTIER FLATS STAGES`, need, reward, family: 'region' })
  );

  // 5) themed clears, all six trail flavors
  for (const th of Object.values(STAGE_THEMES)) {
    ([
      [1, 45],
      [2, 75],
      [3, 115]
    ] as const).forEach(([need, reward]) =>
      pool.push({
        id: `theme-${th.id}-${need}`,
        stat: `clearTheme_${th.id}`,
        label: need === 1 ? `CLEAR A ${th.name} STAGE` : `CLEAR ${need} ${th.name} STAGES`,
        need,
        reward,
        family: 'theme'
      })
    );
  }

  // 6) full-posse finishes
  ([
    [1, 80],
    [2, 130],
    [3, 190]
  ] as const).forEach(([need, reward]) =>
    pool.push({
      id: `posse${need}`,
      stat: 'fullPosse',
      label: need === 1 ? 'FINISH A STAGE WITH ALL 3 STANDING' : `${need} CLEARS WITH ALL 3 STANDING`,
      need,
      reward,
      family: 'posse'
    })
  );

  // 7) mono-type clears - only when 2+ findable basics carry the type
  for (const t of types) {
    if ((typeCounts.get(t) ?? 0) < 2) continue;
    const shown = badgeName(t).toUpperCase();
    pool.push({
      id: `mono-${t}`,
      stat: `monoClear_${t}`,
      label: `CLEAR A STAGE WITH ONLY ${shown} TYPES`,
      need: 1,
      reward: 85,
      family: 'mono'
    });
  }

  // 8) knockouts
  ([
    [10, 45],
    [20, 75],
    [35, 120]
  ] as const).forEach(([need, reward]) =>
    pool.push({ id: `kos${need}`, stat: 'kos', label: `DEFEAT ${need} WILD CRITTERS`, need, reward, family: 'kos' })
  );

  // 9) bosses
  ([
    [1, 55],
    [2, 95],
    [3, 145]
  ] as const).forEach(([need, reward]) =>
    pool.push({
      id: `boss${need}`,
      stat: 'bosses',
      label: need === 1 ? 'DEFEAT A TRAIL BOSS' : `DEFEAT ${need} TRAIL BOSSES`,
      need,
      reward,
      family: 'boss'
    })
  );

  // 10) level-ups
  ([
    [1, 40],
    [3, 75],
    [6, 120]
  ] as const).forEach(([need, reward]) =>
    pool.push({
      id: `lvl${need}`,
      stat: 'levelUps',
      label: need === 1 ? 'LEVEL UP A CRITTER' : `LEVEL UP CRITTERS ${need} TIMES`,
      need,
      reward,
      family: 'level'
    })
  );

  // 11) gold earned wrangling (trail kills, clears, capture pay)
  ([
    [50, 40],
    [120, 70],
    [250, 120]
  ] as const).forEach(([need, reward]) =>
    pool.push({
      id: `gold${need}`,
      stat: 'goldEarned',
      label: `EARN ${need} GOLD OUT WRANGLIN'`,
      need,
      reward,
      family: 'gold'
    })
  );

  // 12) one-offs: rare lassos + clean-rope wins + roundup turn-ins
  pool.push({ id: 'rare1', stat: 'rareCatch', label: 'WRANGLE A RARE EVOLVED CRITTER', need: 1, reward: 150, family: 'rare' });
  pool.push({ id: 'bosscatch1', stat: 'bossCatch', label: 'LASSO A TRAIL BOSS', need: 1, reward: 120, family: 'rare' });
  ([
    [1, 60],
    [3, 120]
  ] as const).forEach(([need, reward]) =>
    pool.push({
      id: `clean${need}`,
      stat: 'cleanCatch',
      label: need === 1 ? 'WIN A CAPTURE WITHOUT A LINE BREAK' : `${need} CAPTURES WITHOUT A LINE BREAK`,
      need,
      reward,
      family: 'clean'
    })
  );
  ([
    [1, 45],
    [2, 80]
  ] as const).forEach(([need, reward]) =>
    pool.push({
      id: `turnin${need}`,
      stat: 'turnInCount',
      label: need === 1 ? 'TURN IN A ROUNDUP CRITTER' : `TURN IN ${need} ROUNDUP CRITTERS`,
      need,
      reward,
      family: 'turnin'
    })
  );

  return pool;
}

/**
 * Today's posted challenges: a seeded shuffle of the pool (same picks all
 * day on every device, new set at local midnight), capped at 2 per template
 * family so one day never reads as six near-identical lines.
 */
export function dailyChallenges(count = CHALLENGES_PER_DAY): ChallengeDef[] {
  const pool = challengePool();
  const rng = seededRng(`challenges-${dateKey()}`);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked: ChallengeDef[] = [];
  const perFamily = new Map<string, number>();
  for (const ch of pool) {
    if (picked.length >= count) break;
    const n = perFamily.get(ch.family) ?? 0;
    if (n >= 2) continue;
    perFamily.set(ch.family, n + 1);
    picked.push(ch);
  }
  // tiny pools (early data) can underfill under the family cap - top up
  for (const ch of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(ch)) picked.push(ch);
  }
  return picked;
}
