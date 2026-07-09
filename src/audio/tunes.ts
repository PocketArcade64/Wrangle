/**
 * Original Wrangle compositions, written as chip-tracker note data (MIDI
 * note numbers on a 16th-note grid, null = rest). Three voices per tune:
 * square lead, triangle bass, filtered-noise percussion - a deliberate
 * NES-era western sound. All melodies composed for this game.
 */

export interface TuneChannel {
  wave: OscillatorType | 'noise';
  vol: number;
  /** Fraction of the step the note sustains (default 0.9). */
  sustain?: number;
  steps: (number | null)[];
}

export interface Tune {
  bpm: number;
  channels: TuneChannel[];
}

export type MusicId = 'home' | 'trail' | 'showdown' | 'lasso';

const _ = null;

/**
 * PORCHLIGHT WALTZ (menus, v2) - 84bpm, G major with a mixolydian lean.
 * The theme players hear most: calm and unhurried, a campfire cowboy tune.
 * Eight bars - a soft rising call (G-Em-C-D), a high lonesome answer, and
 * a gentle settle back home. Long triangle bass roots with the fifth
 * walking underneath, a whisper-quiet drone fifth, brushes like a slow
 * rocking chair.
 */
const HOME: Tune = {
  bpm: 84,
  channels: [
    {
      wave: 'square',
      vol: 0.034,
      steps: [
        67, _, _, _, 71, _, 74, _, 71, _, 69, _, 67, _, _, _,
        64, _, _, _, 67, _, 69, _, 67, _, 64, _, 62, _, _, _,
        64, _, _, _, 67, _, 71, _, 69, _, 67, _, 69, _, 71, _,
        74, _, _, _, 71, _, 69, _, 67, _, _, _, _, _, _, _,
        79, _, _, 76, 74, _, 71, _, 74, _, _, _, _, _, _, _,
        76, _, _, 74, 71, _, 69, _, 71, _, _, _, _, _, _, _,
        69, _, 67, _, 64, _, 67, _, 69, _, 71, _, 74, _, _, _,
        71, _, 69, _, 67, _, _, _, _, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'square',
      vol: 0.011,
      sustain: 7,
      steps: [
        55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        52, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        52, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'triangle',
      vol: 0.11,
      sustain: 2.5,
      steps: [
        43, _, _, _, _, _, _, _, 43, _, _, _, 50, _, _, _,
        40, _, _, _, _, _, _, _, 40, _, _, _, 47, _, _, _,
        48, _, _, _, _, _, _, _, 48, _, _, _, 55, _, _, _,
        50, _, _, _, _, _, _, _, 50, _, _, _, 45, _, _, _,
        43, _, _, _, _, _, _, _, 43, _, _, _, 50, _, _, _,
        40, _, _, _, _, _, _, _, 40, _, _, _, 47, _, _, _,
        48, _, _, _, _, _, _, _, 50, _, _, _, 50, _, _, _,
        43, _, _, _, _, _, _, _, 43, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'noise',
      vol: 0.008,
      steps: [
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _,
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _,
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _,
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _,
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _,
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _,
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _,
        _, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _
      ]
    }
  ]
};

/**
 * RIDE THE LINE (stages) - 132bpm, D mixolydian. Galloping triangle bass
 * under a trail-song melody; hats keep the horse's rhythm.
 */
const TRAIL: Tune = {
  bpm: 132,
  channels: [
    {
      wave: 'square',
      vol: 0.045,
      steps: [
        74, _, _, 72, 71, _, 69, _, 67, _, 69, _, 71, _, 72, _,
        74, _, _, 76, 74, _, 72, _, 71, _, 69, _, 71, _, _, _,
        72, _, _, 71, 69, _, 67, _, 64, _, 66, _, 67, _, 69, _,
        66, _, 67, _, 69, _, 71, _, 74, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'triangle',
      vol: 0.13,
      sustain: 0.55,
      steps: [
        50, _, 50, 50, 50, _, 57, 57, 50, _, 50, 50, 57, _, 50, 50,
        50, _, 50, 50, 50, _, 57, 57, 50, _, 50, 50, 57, _, 50, 50,
        48, _, 48, 48, 48, _, 55, 55, 48, _, 48, 48, 55, _, 48, 48,
        43, _, 43, 43, 45, _, 45, 45, 47, _, 47, 47, 48, _, 50, _
      ]
    },
    {
      wave: 'noise',
      vol: 0.011,
      steps: [
        1, _, 1, _, 1, _, 1, _, 1, _, 1, _, 1, _, 1, 1,
        1, _, 1, _, 1, _, 1, _, 1, _, 1, _, 1, _, 1, 1,
        1, _, 1, _, 1, _, 1, _, 1, _, 1, _, 1, _, 1, 1,
        1, _, 1, _, 1, _, 1, _, 1, _, 1, _, 1, 1, 1, 1
      ]
    }
  ]
};

/**
 * SHOWDOWN (boss) - 148bpm, E minor with a phrygian bite. Driving 16th
 * bass and a taut two-bar call that never quite resolves.
 */
const SHOWDOWN: Tune = {
  bpm: 148,
  channels: [
    {
      wave: 'square',
      vol: 0.045,
      steps: [
        76, _, 76, 77, 76, _, 74, _, 72, _, 74, _, 76, _, _, _,
        72, _, 72, 74, 72, _, 71, _, 69, _, 71, _, 72, _, _, _
      ]
    },
    {
      wave: 'triangle',
      vol: 0.14,
      sustain: 0.5,
      steps: [
        40, 40, 52, 40, 40, 52, 40, 40, 40, 40, 52, 40, 43, 43, 45, 47,
        40, 40, 52, 40, 40, 52, 40, 40, 45, 45, 57, 45, 43, 43, 55, 43
      ]
    },
    {
      wave: 'noise',
      vol: 0.018,
      steps: [
        1, _, 1, _, 1, _, 1, 1, 1, _, 1, _, 1, _, 1, 1,
        1, _, 1, _, 1, _, 1, 1, 1, _, 1, _, 1, 1, 1, 1
      ]
    }
  ]
};

/**
 * ROPE'S EYE (lasso minigame) - 120bpm, A minor with a raised-6th sparkle.
 * Tense but playful ropework: a circling four-bar riff that keeps leaning
 * forward (the loop never quite rests), galloping bass under it, shaker
 * on the off-beats. Written to sit UNDER the loop/snap sfx, not fight them.
 */
const LASSO: Tune = {
  bpm: 120,
  channels: [
    {
      wave: 'square',
      vol: 0.032,
      steps: [
        69, _, _, 72, 74, _, 72, _, 69, _, _, _, 76, _, 74, _,
        72, _, _, 74, 76, _, 79, _, 76, _, 74, _, 72, _, 69, _,
        69, _, _, 72, 74, _, 72, _, 69, _, 67, _, 64, _, 67, _,
        69, _, _, _, 76, _, _, 74, _, _, 72, _, 69, _, _, _
      ]
    },
    {
      wave: 'square',
      vol: 0.009,
      sustain: 7,
      steps: [
        57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        53, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        52, _, _, _, _, _, _, _, 57, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'triangle',
      vol: 0.12,
      sustain: 0.55,
      steps: [
        45, _, 45, 45, 52, _, 45, _, 45, _, 45, 45, 52, _, 45, _,
        43, _, 43, 43, 50, _, 43, _, 43, _, 43, 43, 50, _, 43, _,
        41, _, 41, 41, 48, _, 41, _, 41, _, 41, 41, 48, _, 41, _,
        40, _, 40, 40, 47, _, 40, _, 45, _, 45, 45, 52, _, 45, _
      ]
    },
    {
      wave: 'noise',
      vol: 0.009,
      steps: [
        _, _, 1, _, _, _, 1, _, _, _, 1, _, _, _, 1, 1,
        _, _, 1, _, _, _, 1, _, _, _, 1, _, _, _, 1, _,
        _, _, 1, _, _, _, 1, _, _, _, 1, _, _, _, 1, 1,
        _, _, 1, _, _, _, 1, _, _, _, 1, _, 1, _, 1, _
      ]
    }
  ]
};

export const TUNES: Record<MusicId, Tune> = {
  home: HOME,
  trail: TRAIL,
  showdown: SHOWDOWN,
  lasso: LASSO
};
