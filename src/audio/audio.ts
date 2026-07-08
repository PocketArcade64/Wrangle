import { Tune, TUNES, MusicId } from './tunes';

/**
 * Wrangle's audio engine - ALL sound is synthesized in code with the Web
 * Audio API (square/triangle chip voices + filtered noise), so every note
 * and effect is original and no audio files ship with the game.
 *
 * iOS requires a user gesture before audio can start: main.ts calls
 * unlockAudio() on the first pointerdown.
 */

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let musicGain: GainNode | undefined;

function ensureCtx(): AudioContext | undefined {
  if (!ctx) {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return undefined;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a user gesture (main.ts wires the first pointerdown). */
export function unlockAudio(): void {
  ensureCtx();
}

// ---------- synth primitives ----------

interface ToneOpts {
  wave?: OscillatorType;
  vol?: number;
  /** Multiply frequency by this over the duration (pitch slide). */
  slide?: number;
  at?: number;
  out?: GainNode;
}

function tone(freq: number, dur: number, opts: ToneOpts = {}): void {
  const c = ensureCtx();
  if (!c || !master) return;
  const t0 = opts.at ?? c.currentTime;
  const osc = c.createOscillator();
  osc.type = opts.wave ?? 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide && opts.slide !== 1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t0 + dur);
  }
  const g = c.createGain();
  const v = opts.vol ?? 0.12;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(v, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  osc.connect(g);
  g.connect(opts.out ?? master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

let noiseBuf: AudioBuffer | undefined;

function noise(dur: number, opts: { vol?: number; freq?: number; slide?: number; at?: number; out?: GainNode } = {}): void {
  const c = ensureCtx();
  if (!c || !master) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = opts.at ?? c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(opts.freq ?? 2400, t0);
  if (opts.slide && opts.slide !== 1) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, (opts.freq ?? 2400) * opts.slide), t0 + dur);
  }
  const g = c.createGain();
  const v = opts.vol ?? 0.1;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(v, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(opts.out ?? master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ---------- sound effects ----------

export type SfxName =
  | 'ui'
  | 'coin'
  | 'capture'
  | 'bust'
  | 'hit'
  | 'hurt'
  | 'faint'
  | 'whip'
  | 'lob'
  | 'burst'
  | 'wave'
  | 'zap'
  | 'beam'
  | 'dash'
  | 'tether'
  | 'holler'
  | 'levelup'
  | 'discover'
  | 'swap'
  | 'clear'
  | 'fail'
  | 'boss'
  | 'punch'
  | 'spin';

/** Fire-and-forget synthesized effect. Safe to call before unlock (no-op). */
export function sfx(name: SfxName): void {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  switch (name) {
    case 'ui':
      tone(520, 0.05, { vol: 0.06 });
      break;
    case 'coin':
      tone(880, 0.06, { vol: 0.08 });
      tone(1320, 0.1, { vol: 0.08, at: t + 0.06 });
      break;
    case 'capture':
      tone(392, 0.09, { vol: 0.12 });
      tone(523, 0.09, { at: t + 0.09, vol: 0.12 });
      tone(659, 0.09, { at: t + 0.18, vol: 0.12 });
      tone(784, 0.22, { at: t + 0.27, vol: 0.14 });
      break;
    case 'bust':
      tone(220, 0.25, { wave: 'sawtooth', slide: 0.5, vol: 0.1 });
      noise(0.3, { freq: 900, slide: 0.4, vol: 0.08 });
      break;
    case 'hit':
      noise(0.07, { freq: 1800, slide: 0.5, vol: 0.09 });
      tone(160, 0.06, { wave: 'triangle', slide: 0.7, vol: 0.1 });
      break;
    case 'hurt':
      tone(200, 0.14, { wave: 'sawtooth', slide: 0.6, vol: 0.09 });
      break;
    case 'faint':
      tone(392, 0.1, { vol: 0.1 });
      tone(311, 0.1, { at: t + 0.1, vol: 0.1 });
      tone(233, 0.24, { at: t + 0.2, slide: 0.7, vol: 0.1 });
      break;
    case 'whip':
      noise(0.09, { freq: 3600, slide: 0.25, vol: 0.12 });
      break;
    case 'lob':
      tone(300, 0.18, { wave: 'triangle', slide: 1.8, vol: 0.08 });
      break;
    case 'burst':
      noise(0.22, { freq: 1400, slide: 0.35, vol: 0.12 });
      tone(120, 0.18, { wave: 'triangle', slide: 0.6, vol: 0.12 });
      break;
    case 'wave':
      noise(0.4, { freq: 700, slide: 1.6, vol: 0.09 });
      break;
    case 'zap':
      tone(1400, 0.06, { wave: 'sawtooth', slide: 0.4, vol: 0.08 });
      noise(0.05, { freq: 4200, vol: 0.05 });
      break;
    case 'beam':
      tone(90, 0.3, { wave: 'sawtooth', slide: 8, vol: 0.09 });
      break;
    case 'dash':
      noise(0.14, { freq: 1600, slide: 2.4, vol: 0.08 });
      break;
    case 'tether':
      tone(700, 0.09, { wave: 'square', slide: 0.5, vol: 0.07 });
      break;
    case 'holler':
      tone(330, 0.3, { wave: 'square', slide: 1.4, vol: 0.09 });
      break;
    case 'levelup':
      tone(523, 0.08, { vol: 0.11 });
      tone(659, 0.08, { at: t + 0.08, vol: 0.11 });
      tone(784, 0.08, { at: t + 0.16, vol: 0.11 });
      tone(1047, 0.26, { at: t + 0.24, vol: 0.13 });
      break;
    case 'discover':
      tone(659, 0.07, { vol: 0.08 });
      tone(988, 0.14, { at: t + 0.07, vol: 0.08 });
      break;
    case 'swap':
      tone(440, 0.06, { vol: 0.08 });
      tone(587, 0.09, { at: t + 0.06, vol: 0.08 });
      break;
    case 'clear':
      [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.12, { at: t + i * 0.09, vol: 0.11 }));
      break;
    case 'fail':
      tone(330, 0.16, { wave: 'triangle', vol: 0.1 });
      tone(262, 0.16, { wave: 'triangle', at: t + 0.16, vol: 0.1 });
      tone(196, 0.4, { wave: 'triangle', at: t + 0.32, slide: 0.8, vol: 0.1 });
      break;
    case 'boss':
      tone(98, 0.5, { wave: 'sawtooth', vol: 0.12 });
      tone(104, 0.5, { wave: 'sawtooth', at: t + 0.05, vol: 0.1 });
      noise(0.5, { freq: 400, slide: 0.5, vol: 0.06 });
      break;
    case 'punch':
      noise(0.1, { freq: 1200, slide: 0.4, vol: 0.12 });
      tone(700, 0.12, { at: t + 0.09, vol: 0.09 });
      break;
    case 'spin':
      tone(600, 0.04, { vol: 0.05 });
      break;
  }
}

// ---------- music (chip tracker) ----------

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface MusicState {
  id: MusicId;
  tune: Tune;
  step: number;
  nextTime: number;
  timer: number;
}

let music: MusicState | undefined;

/** Loop a composed tune; switching songs restarts, same song keeps playing. */
export function playMusic(id: MusicId): void {
  const c = ensureCtx();
  if (!c || !musicGain) return;
  if (music && music.id === id) return;
  stopMusic();
  const tune = TUNES[id];
  const state: MusicState = { id, tune, step: 0, nextTime: c.currentTime + 0.06, timer: 0 };
  music = state;
  const stepDur = 60 / tune.bpm / 4;
  const tick = () => {
    if (music !== state || !ctx || !musicGain) return;
    while (state.nextTime < ctx.currentTime + 0.14) {
      for (const ch of tune.channels) {
        const note = ch.steps[state.step % ch.steps.length];
        if (note !== null) {
          if (ch.wave === 'noise') {
            noise(stepDur * 0.55, { freq: 3200, slide: 0.4, vol: ch.vol, at: state.nextTime, out: musicGain });
          } else {
            tone(midiHz(note), stepDur * (ch.sustain ?? 0.9), {
              wave: ch.wave,
              vol: ch.vol,
              at: state.nextTime,
              out: musicGain
            });
          }
        }
      }
      state.step++;
      state.nextTime += stepDur;
    }
    state.timer = window.setTimeout(tick, 30);
  };
  tick();
}

export function stopMusic(): void {
  if (music) {
    clearTimeout(music.timer);
    music = undefined;
  }
}
