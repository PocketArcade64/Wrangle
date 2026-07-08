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

export type MusicId = 'home' | 'trail' | 'showdown';

const _ = null;

/**
 * DUSTY HOMESTEAD (menus) - 92bpm, A minor pentatonic. A lonesome porch
 * melody over a slow walking bass; sparse brushes like wind on the flats.
 */
const HOME: Tune = {
  bpm: 92,
  channels: [
    {
      wave: 'square',
      vol: 0.038,
      steps: [
        69, _, _, _, 72, _, 74, _, 76, _, _, _, 74, _, 72, _,
        69, _, _, _, 67, _, 64, _, 62, _, _, _, _, _, _, _,
        64, _, _, _, 67, _, 69, _, 72, _, _, _, 69, _, 67, _,
        64, _, 62, _, 60, _, _, _, 57, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'square',
      vol: 0.016,
      sustain: 3.6,
      steps: [
        64, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        62, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        60, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
        57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'triangle',
      vol: 0.12,
      sustain: 1.6,
      steps: [
        45, _, _, _, _, _, _, _, 45, _, _, _, 52, _, _, _,
        43, _, _, _, _, _, _, _, 43, _, _, _, 50, _, _, _,
        41, _, _, _, _, _, _, _, 41, _, _, _, 48, _, _, _,
        40, _, _, _, _, _, _, _, 45, _, _, _, _, _, _, _
      ]
    },
    {
      wave: 'noise',
      vol: 0.012,
      steps: [
        _, _, _, _, 1, _, _, _, _, _, _, _, 1, _, _, _,
        _, _, _, _, 1, _, _, _, _, _, _, _, 1, _, _, _,
        _, _, _, _, 1, _, _, _, _, _, _, _, 1, _, _, _,
        _, _, _, _, 1, _, _, _, _, _, _, _, 1, _, _, _
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

export const TUNES: Record<MusicId, Tune> = {
  home: HOME,
  trail: TRAIL,
  showdown: SHOWDOWN
};
