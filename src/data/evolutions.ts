/**
 * Evolution lines: basic -> next stage. Drives Rumble-style spawn groups
 * (a pack of basics with a rare evolved form in the center) and keeps
 * evolved species OUT of the wild basic pools.
 *
 * USER: these were inferred from the CSV name stems - please verify and
 * correct/extend. Species missing from this map simply never show an
 * evolved rare in their groups (safe default). Uncertain guesses are
 * commented out below rather than risked.
 */
export const EVOLUTIONS: Record<string, string> = {
  herbifuzz: 'telefluff',
  telefluff: 'bloomancer',
  flambaa: 'shearfire',
  shearfire: 'ramageddon',
  narqua: 'narstream',
  narstream: 'aquarion',
  chipper: 'chipunk',
  cocoonir: 'mothrae',
  mothrae: 'mothrax',
  picodew: 'nanodrop',
  nanodrop: 'microsplash',
  toxnome: 'gnomore',
  shrimpulse: 'shrimlock',
  shrimlock: 'shrimpire'
  // Unverified guesses - uncomment/correct as you confirm your families:
  // peafolia: 'floracox',
  // ribitta: 'amphivy',
  // humminga: 'nectara',
  // swordine: 'marlash',
  // bulboak: 'sapotox'
};

/** Every species that is an evolution of something (not a wild basic). */
export const EVOLVED_IDS = new Set(Object.values(EVOLUTIONS));

/** Evolution stage: 0 = wild basic, 1 = first evolution, 2 = final. */
export function evoStage(id: string): number {
  let stage = 0;
  let cur = id;
  while (stage < 2 && EVOLVED_IDS.has(cur)) {
    const parent = Object.keys(EVOLUTIONS).find((k) => EVOLUTIONS[k] === cur);
    if (!parent) break;
    stage++;
    cur = parent;
  }
  return stage;
}
