import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { gameState } from '../state/GameState';
import { COLORS } from './theme';
import { dateKey, seededRng } from '../util/daily';

/**
 * The living-vignette toolkit shared by the title screen and the home
 * diorama: a real-time pixel sky (dawn / day / dusk / dark-moon night keyed
 * to the actual clock), frontier terrain drawing, and wandering critters
 * with two depth lanes (background walkers render smaller and behind the
 * mid-ground props), pixel emotion bubbles and excited hops.
 *
 * Pixel discipline: flat banded skies (no gradients), per-pixel discs and
 * staircase silhouettes on a 4px grid, square emotion bubbles.
 */

// ---------- tuning knobs ----------

/** Creature PNGs face LEFT natively - flip this if the art faces right. */
const ART_FACES_LEFT = true;
/** Local-clock day boundaries (fractional hours). */
const DAWN_START = 5;
const DAY_START = 7.5;
const DUSK_START = 17.5;
const NIGHT_START = 20.5;
/** Walker speeds by lane, px/s (distance walks slower = feels farther). */
const FRONT_SPEED = 46;
const BACK_SPEED = 30;
/** Chance a wander leg switches depth lane. */
const LANE_SWITCH_CHANCE = 0.3;
/** Idle-window odds of a bubble / an excited hop. */
const EMOTE_CHANCE = 0.3;
const JUMP_CHANCE = 0.2;
/** How often the home pair tries to meet up (ms between attempts). */
const GREET_EVERY_MS = 11000;

// ---------- time-of-day sky ----------

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface SkyLook {
  phase: DayPhase;
  /** Flat sky bands, top -> horizon. */
  bands: [number, number, number];
  /** 0..1 travel along the horizon arc for the sun (moon at night). */
  orbT: number;
  isMoon: boolean;
  /** Terrain palette tuned to the light. */
  ground: number;
  groundDark: number;
  mesa: number;
  haze: number;
  cactus: number;
  wood: number;
  /** True when ink text reads well over this sky (day-side phases). */
  darkText: boolean;
}

/** The sky right now, from the player's real local clock. */
export function skyLook(now: Date = new Date()): SkyLook {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= DAWN_START && h < DAY_START) {
    return {
      phase: 'dawn',
      bands: [0x7d8ba0, 0xcf9a5e, 0xe4c07e],
      orbT: (h - DAWN_START) / (NIGHT_START - DAWN_START),
      isMoon: false,
      ground: 0xcdb083,
      groundDark: 0xbc9d72,
      mesa: 0x5d6d85,
      haze: 0xe4c07e,
      cactus: 0x74836a,
      wood: 0x5c3720,
      darkText: true
    };
  }
  if (h >= DAY_START && h < DUSK_START) {
    return {
      phase: 'day',
      bands: [0xa3bfc7, 0xc6ccae, 0xe3d5ab],
      orbT: (h - DAWN_START) / (NIGHT_START - DAWN_START),
      isMoon: false,
      ground: COLORS.sand,
      groundDark: 0xc9ae7e,
      mesa: COLORS.denim,
      haze: COLORS.parchmentDark,
      cactus: COLORS.sage,
      wood: COLORS.saddleDark,
      darkText: true
    };
  }
  if (h >= DUSK_START && h < NIGHT_START) {
    return {
      phase: 'dusk',
      bands: [0x5d6480, 0xb5714a, 0xd99e63],
      orbT: (h - DAWN_START) / (NIGHT_START - DAWN_START),
      isMoon: false,
      ground: 0xc2a071,
      groundDark: 0xb08d5f,
      mesa: 0x474d66,
      haze: 0xd99e63,
      cactus: 0x6c7a63,
      wood: 0x4a2e1c,
      darkText: true
    };
  }
  // night - the dark moon rides the same arc the sun did
  const hn = h < DAWN_START ? h + 24 : h;
  return {
    phase: 'night',
    bands: [0x1c2130, 0x272e42, 0x343c52],
    orbT: (hn - NIGHT_START) / (24 - NIGHT_START + DAWN_START),
    isMoon: true,
    ground: 0x595b6e,
    groundDark: 0x4a4c5e,
    mesa: 0x232838,
    haze: 0x343c52,
    cactus: 0x3e4550,
    wood: 0x2e2a33,
    darkText: false
  };
}

const q4 = (n: number) => Math.round(n / 4) * 4;

/** Staircase-quantized pixel disc (4px rows - never a smooth circle). */
function pixelDisc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number): void {
  g.fillStyle(color);
  for (let yy = -r; yy < r; yy += 4) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - (yy + 2) * (yy + 2))) / 4) * 4;
    if (half > 0) g.fillRect(cx - half, cy + yy, half * 2, 4);
  }
}

function sunRays(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number): void {
  g.fillStyle(color);
  const o = r + 8;
  g.fillRect(cx - 2, cy - o - 12, 4, 12);
  g.fillRect(cx - 2, cy + o, 4, 12);
  g.fillRect(cx - o - 12, cy - 2, 12, 4);
  g.fillRect(cx + o, cy - 2, 12, 4);
  const d = q4((r + 10) * 0.707);
  for (const [sx, sy] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ]) {
    g.fillRect(cx + sx * d - 2, cy + sy * d - 2, 6, 6);
  }
}

/**
 * Banded sky + the sun (or dark moon) at its real-time arc position, plus
 * a stable field of stars at night (seeded per day). Draw terrain after
 * this so silhouettes sit in front of a low sun.
 */
export function drawSky(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  horizonY: number,
  look: SkyLook
): void {
  const total = horizonY - y;
  const h1 = Math.round(total * 0.45);
  const h2 = Math.round(total * 0.32);
  g.fillStyle(look.bands[0]);
  g.fillRect(x, y, w, h1);
  g.fillStyle(look.bands[1]);
  g.fillRect(x, y + h1, w, h2);
  g.fillStyle(look.bands[2]);
  g.fillRect(x, y + h1 + h2, w, total - h1 - h2);

  if (look.phase === 'night') {
    const rng = seededRng(`sky-${dateKey()}`);
    const count = Math.max(10, Math.floor(w / 22));
    for (let i = 0; i < count; i++) {
      const sx = x + 8 + rng() * (w - 16);
      const sy = y + 8 + rng() * Math.max(20, total - 60);
      const s = rng() < 0.25 ? 3 : 2;
      g.fillStyle(rng() < 0.7 ? 0xe8e4d2 : 0xaab3c4, 0.9);
      g.fillRect(Math.round(sx), Math.round(sy), s, s);
    }
  }

  // the orb rides a flat-topped arc between the rect's side margins
  const t = Phaser.Math.Clamp(look.orbT, 0, 1);
  const cx = q4(x + 60 + t * (w - 120));
  const amp = Math.max(50, total - (look.isMoon ? 120 : 90));
  const cy = q4(Math.max(y + 44, horizonY - 24 - Math.sin(t * Math.PI) * amp));

  if (look.isMoon) {
    // dark moon: dim disc, craters, unlit face biting a crescent
    pixelDisc(g, cx, cy, 26, 0x97a1ae);
    g.fillStyle(0x6e7889);
    g.fillRect(cx - 14, cy + 2, 6, 6);
    g.fillRect(cx - 4, cy + 12, 4, 4);
    pixelDisc(g, cx + 10, cy - 6, 21, 0x3d4457);
  } else if (look.phase === 'day') {
    pixelDisc(g, cx, cy, 26, 0xf6ead0);
    sunRays(g, cx, cy, 26, 0xf6ead0);
  } else {
    // low heavy dawn/dusk sun, no rays
    const color = look.phase === 'dawn' ? 0xe8b164 : 0xd97f4e;
    pixelDisc(g, cx, cy, 34, color);
  }
}

// ---------- frontier terrain ----------

export function drawCactus(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, color: number): void {
  g.fillStyle(color);
  g.fillRect(x, y - 34 * s, 9 * s, 34 * s);
  g.fillRect(x - 8 * s, y - 26 * s, 8 * s, 5 * s);
  g.fillRect(x - 8 * s, y - 34 * s, 5 * s, 12 * s);
  g.fillRect(x + 9 * s, y - 18 * s, 8 * s, 5 * s);
  g.fillRect(x + 12 * s, y - 26 * s, 5 * s, 12 * s);
}

function drawMesa(g: Phaser.GameObjects.Graphics, x: number, baseY: number, w: number, h: number, color: number): void {
  g.fillStyle(color);
  g.fillRect(Math.round(x), baseY - Math.round(h * 0.72), Math.round(w), Math.round(h * 0.72));
  g.fillRect(Math.round(x + w * 0.16), baseY - h, Math.round(w * 0.68), Math.round(h * 0.34));
}

/** Prairie windmill silhouette - the Frontier Flats landmark. */
function drawWindmill(g: Phaser.GameObjects.Graphics, bx: number, baseY: number, s: number, color: number): void {
  g.fillStyle(color);
  g.fillRect(bx - 7 * s, baseY - 6 * s, 14 * s, 6 * s);
  g.fillRect(bx - 5 * s, baseY - 14 * s, 10 * s, 8 * s);
  g.fillRect(bx - 3 * s, baseY - 22 * s, 6 * s, 8 * s);
  g.fillRect(bx - 4 * s, baseY - 27 * s, 8 * s, 5 * s);
  const hubY = baseY - 25 * s;
  for (let k = 1; k <= 4; k++) {
    const d = k * 3 * s;
    g.fillRect(bx + d - s, hubY - d - s, 2 * s, 2 * s);
    g.fillRect(bx - d - s, hubY - d - s, 2 * s, 2 * s);
    g.fillRect(bx + d - s, hubY + d - s, 2 * s, 2 * s);
    g.fillRect(bx - d - s, hubY + d - s, 2 * s, 2 * s);
  }
  g.fillRect(bx - 2 * s, hubY - 2 * s, 4 * s, 4 * s);
}

/**
 * Everything BEHIND the walkers: ground plane, horizon haze, mesas and the
 * windmill on the skyline. Draw right after the sky.
 */
export function drawFrontierBackdrop(
  g: Phaser.GameObjects.Graphics,
  x: number,
  w: number,
  horizonY: number,
  bottomY: number,
  look: SkyLook
): void {
  // skyline silhouettes
  drawMesa(g, x + w * 0.04, horizonY, w * 0.24, 96, look.mesa);
  drawMesa(g, x + w * 0.2, horizonY, w * 0.13, 56, look.mesa);
  drawMesa(g, x + w * 0.66, horizonY, w * 0.3, 74, look.mesa);
  drawWindmill(g, Math.round(x + w * 0.55), horizonY, 2, look.mesa);
  // haze where the flats meet the sky
  g.fillStyle(look.haze);
  g.fillRect(x, horizonY - 8, w, 8);
  // the flats
  g.fillStyle(look.ground);
  g.fillRect(x, horizonY, w, bottomY - horizonY);
  g.fillStyle(look.groundDark, 0.55);
  const specks = Math.floor((w * (bottomY - horizonY)) / 2600);
  for (let i = 0; i < specks; i++) {
    g.fillRect(
      Math.round(x + Math.random() * (w - 4)),
      Math.round(horizonY + 6 + Math.random() * (bottomY - horizonY - 12)),
      3,
      3
    );
  }
}

/**
 * Mid-ground props the FRONT-lane walkers pass in front of and the BACK
 * lane walks behind: cacti, a fence run, brush tufts. Sits in the lower
 * half of the ground plane.
 */
export function drawFrontierForeground(
  g: Phaser.GameObjects.Graphics,
  x: number,
  w: number,
  horizonY: number,
  bottomY: number,
  look: SkyLook
): void {
  const midY = Math.round(horizonY + (bottomY - horizonY) * 0.55);
  drawCactus(g, x + w * 0.82, midY + 10, 1.3, look.cactus);
  drawCactus(g, x + w * 0.09, midY - 4, 0.9, look.cactus);
  // fence run on the left
  g.fillStyle(look.wood);
  const fenceY = midY + 18;
  for (let fx = x + 24; fx < x + w * 0.44; fx += 62) {
    g.fillRect(Math.round(fx), fenceY - 24, 6, 26);
  }
  g.fillRect(x + 24, fenceY - 18, Math.round(w * 0.44 - 24), 4);
  // brush tufts
  g.fillStyle(look.cactus, 0.9);
  for (let i = 0; i < 5; i++) {
    const bx = Math.round(x + 20 + Math.random() * (w - 60));
    const by = Math.round(midY + 6 + Math.random() * (bottomY - midY - 18));
    g.fillRect(bx, by, 4, 4);
    g.fillRect(bx + 5, by - 3, 4, 7);
    g.fillRect(bx + 10, by, 4, 4);
  }
}

// ---------- emotion bubbles ----------

export type BubbleKind = 'heart' | 'note' | 'alert' | 'zzz' | 'happy';

const BUBBLE_SYMBOLS: Record<BubbleKind, { rows: string[]; color: number }> = {
  heart: {
    color: 0xc06f5f,
    rows: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
  },
  note: {
    color: 0x3f5c6c,
    rows: ['..XXXX', '..X..X', '..X..X', '..X...', 'XXX...', 'XXX...']
  },
  alert: {
    color: 0xc1652f,
    rows: ['XXX', 'XXX', 'XXX', 'XXX', '...', 'XXX']
  },
  zzz: {
    color: 0x3f5c6c,
    rows: ['XXXXX.XXX', '...X...X.', '..X...XXX', '.X.......', 'XXXXX....', '.........']
  },
  happy: {
    color: 0x7c8b6f,
    rows: ['XX...XX', '.......', 'X.....X', '.XXXXX.']
  }
};

const BUB_CELL = 2; // px per bitmap cell
const BUB_W = 15; // bubble body cells wide
const BUB_H = 10; // bubble body cells tall (tail adds 3 below)

/** Generate the 'bub-*' textures once per scene (square pixel bubbles). */
export function ensureBubbles(scene: Phaser.Scene): void {
  for (const kind of Object.keys(BUBBLE_SYMBOLS) as BubbleKind[]) {
    const key = `bub-${kind}`;
    if (scene.textures.exists(key)) continue;
    const { rows, color } = BUBBLE_SYMBOLS[kind];
    const g = scene.add.graphics();
    // body: ink border, parchment face - sharp square corners
    g.fillStyle(COLORS.ink);
    g.fillRect(0, 0, BUB_W * BUB_CELL, BUB_H * BUB_CELL);
    g.fillStyle(COLORS.parchmentLight);
    g.fillRect(BUB_CELL, BUB_CELL, (BUB_W - 2) * BUB_CELL, (BUB_H - 2) * BUB_CELL);
    // tail spike, bottom left
    g.fillStyle(COLORS.ink);
    g.fillRect(2 * BUB_CELL, BUB_H * BUB_CELL, 5 * BUB_CELL, BUB_CELL);
    g.fillRect(3 * BUB_CELL, (BUB_H + 1) * BUB_CELL, 3 * BUB_CELL, BUB_CELL);
    g.fillRect(4 * BUB_CELL, (BUB_H + 2) * BUB_CELL, BUB_CELL, BUB_CELL);
    // symbol, centered in the face
    const symW = rows[0].length;
    const offX = Math.floor((BUB_W - symW) / 2);
    const offY = Math.max(1, Math.floor((BUB_H - rows.length) / 2));
    g.fillStyle(color);
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === 'X') {
          g.fillRect((offX + rx) * BUB_CELL, (offY + ry) * BUB_CELL, BUB_CELL, BUB_CELL);
        }
      }
    });
    g.generateTexture(key, BUB_W * BUB_CELL, (BUB_H + 3) * BUB_CELL);
    g.destroy();
  }
}

// ---------- wandering critters ----------

/** Species the player has laid eyes on (ledger seen or owned). */
export function seenSpecies(): SpeciesDef[] {
  return SPECIES.filter(
    (sp) => (gameState.data.seen[sp.id] ?? 0) > 0 || gameState.data.herd.some((c) => c.speciesId === sp.id)
  );
}

type Lane = 'front' | 'back';

interface Walker {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Rectangle;
  lane: Lane;
  busy: boolean;
  /** Bumped to cancel this walker's queued callbacks (greet hijacks). */
  seq: number;
  walkTween?: Phaser.Tweens.Tween;
  bobTween?: Phaser.Tweens.Tween;
  shadowTween?: Phaser.Tweens.Tween;
}

export interface TroupeOpts {
  left: number;
  right: number;
  /** Feet baselines for the two depth lanes. */
  frontY: number;
  backY: number;
  /** Critter display sizes (px) per lane - back is smaller = farther. */
  frontSize: number;
  backSize: number;
  /** Layer for the front lane (draw AFTER the mid-ground props). */
  frontLayer: Phaser.GameObjects.Container;
  /** Layer for the back lane (draw BEFORE the mid-ground props). */
  backLayer: Phaser.GameObjects.Container;
  /** Home mode: the pair wander over to greet each other now and then. */
  interact?: boolean;
}

/**
 * A little troupe of wandering critters with depth-of-field lanes. Every
 * tween/timer is scene-owned, so scene shutdown cleans the troupe up.
 */
export class WalkerTroupe {
  private walkers: Walker[] = [];

  constructor(
    private scene: Phaser.Scene,
    species: SpeciesDef[],
    private opts: TroupeOpts
  ) {
    ensureBubbles(scene);
    species.forEach((sp, i) => this.spawn(sp, i));
    if (opts.interact && this.walkers.length >= 2) {
      scene.time.addEvent({ delay: GREET_EVERY_MS, loop: true, callback: () => this.tryGreet() });
    }
  }

  private laneY(lane: Lane): number {
    return lane === 'front' ? this.opts.frontY : this.opts.backY;
  }

  private laneSize(lane: Lane): number {
    return lane === 'front' ? this.opts.frontSize : this.opts.backSize;
  }

  private layer(lane: Lane): Phaser.GameObjects.Container {
    return lane === 'front' ? this.opts.frontLayer : this.opts.backLayer;
  }

  private scaleFor(w: Walker, lane: Lane): number {
    return this.laneSize(lane) / Math.max(w.img.width, w.img.height);
  }

  /** Schedule a callback that dies quietly if the walker gets hijacked. */
  private later(w: Walker, ms: number, fn: () => void): void {
    const s = w.seq;
    this.scene.time.delayedCall(ms, () => {
      if (w.seq === s && w.img.active) fn();
    });
  }

  private spawn(sp: SpeciesDef, i: number): void {
    const { left, right } = this.opts;
    const lane: Lane = i % 2 === 0 ? 'front' : 'back';
    const key = this.scene.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const x = Math.round(left + 50 + Math.random() * (right - left - 100));
    const img = this.scene.add.image(x, this.laneY(lane), key).setOrigin(0.5, 1);
    const shadow = this.scene.add
      .rectangle(x, this.laneY(lane), Math.round(this.opts.frontSize * 0.66), 6, COLORS.ink, 0.16)
      .setOrigin(0.5, 0.5);
    const w: Walker = { img, shadow, lane, busy: false, seq: 0 };
    img.setScale(this.scaleFor(w, lane));
    shadow.setScale(lane === 'front' ? 1 : 0.62, 1);
    this.layer(lane).add([shadow, img]);
    this.walkers.push(w);
    this.later(w, 300 + Math.random() * 1200, () => this.next(w));
  }

  /** Pick the next wander leg (maybe drifting to the other depth lane). */
  private next(w: Walker): void {
    if (w.busy) return;
    const { left, right } = this.opts;
    const toLane: Lane =
      Math.random() < LANE_SWITCH_CHANCE ? (w.lane === 'front' ? 'back' : 'front') : w.lane;
    const targetX = Math.round(left + 50 + Math.random() * (right - left - 100));
    this.walkTo(w, targetX, toLane, () => this.idle(w));
  }

  private walkTo(w: Walker, targetX: number, toLane: Lane, done: () => void): void {
    const changing = toLane !== w.lane;
    if (changing) {
      // reparent now so it slips behind/in front of the props while moving
      this.layer(w.lane).remove(w.shadow);
      this.layer(w.lane).remove(w.img);
      this.layer(toLane).add([w.shadow, w.img]);
      w.lane = toLane;
    }
    const dx = Math.abs(targetX - w.img.x);
    if (dx < 10 && !changing) {
      done();
      return;
    }
    const facingLeft = targetX < w.img.x;
    w.img.setFlipX(ART_FACES_LEFT ? !facingLeft : facingLeft);
    const speed = toLane === 'front' ? FRONT_SPEED : BACK_SPEED;
    const duration = Math.max(300, (dx / speed) * 1000);
    w.walkTween?.remove();
    w.bobTween?.remove();
    w.shadowTween?.remove();
    w.bobTween = undefined;
    const s = w.seq;
    if (changing) {
      // receding/approaching leg: glide position + scale between lanes
      w.walkTween = this.scene.tweens.add({
        targets: w.img,
        x: targetX,
        y: this.laneY(toLane),
        scaleX: this.scaleFor(w, toLane),
        scaleY: this.scaleFor(w, toLane),
        duration,
        onComplete: () => {
          if (w.seq === s) done();
        }
      });
      w.shadowTween = this.scene.tweens.add({
        targets: w.shadow,
        x: targetX,
        y: this.laneY(toLane),
        scaleX: toLane === 'front' ? 1 : 0.62,
        duration
      });
    } else {
      // level leg: soft walk bob around the baseline
      w.bobTween = this.scene.tweens.add({
        targets: w.img,
        y: this.laneY(toLane) - 4,
        duration: 240,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      w.walkTween = this.scene.tweens.add({
        targets: w.img,
        x: targetX,
        duration,
        onComplete: () => {
          if (w.seq !== s) return;
          w.bobTween?.remove();
          w.bobTween = undefined;
          w.img.y = this.laneY(w.lane);
          done();
        }
      });
      w.shadowTween = this.scene.tweens.add({ targets: w.shadow, x: targetX, duration });
    }
  }

  private idle(w: Walker): void {
    this.later(w, 500 + Math.random() * 1800, () => {
      if (w.busy) return;
      const roll = Math.random();
      let wait = 400 + Math.random() * 600;
      if (roll < EMOTE_CHANCE) {
        this.bubble(w, (['note', 'alert', 'zzz', 'happy'] as BubbleKind[])[Math.floor(Math.random() * 4)]);
        wait = 1300 + Math.random() * 400; // stand with the bubble up
      } else if (roll < EMOTE_CHANCE + JUMP_CHANCE) {
        this.hop(w);
        if (Math.random() < 0.5) this.bubble(w, 'happy');
        wait = 800 + Math.random() * 400;
      }
      this.later(w, wait, () => this.next(w));
    });
  }

  /** Pixel emotion bubble popping in over the walker's head. */
  private bubble(w: Walker, kind: BubbleKind): void {
    const scale = w.lane === 'front' ? 2 : 1;
    const bub = this.scene.add
      .image(Math.round(w.img.x + 10), Math.round(w.img.y - w.img.displayHeight - 6), `bub-${kind}`)
      .setOrigin(0.5, 1)
      .setScale(scale * 0.4);
    this.layer(w.lane).add(bub);
    this.scene.tweens.add({ targets: bub, scaleX: scale, scaleY: scale, duration: 130, ease: 'Quad.easeOut' });
    this.scene.tweens.add({
      targets: bub,
      alpha: 0,
      delay: 1000,
      duration: 160,
      onComplete: () => bub.destroy()
    });
  }

  /** Excited double-hop. */
  private hop(w: Walker): void {
    const baseY = this.laneY(w.lane);
    w.img.y = baseY;
    this.scene.tweens.add({
      targets: w.img,
      y: baseY - (w.lane === 'front' ? 26 : 16),
      duration: 170,
      yoyo: true,
      repeat: 1,
      ease: 'Quad.easeOut'
    });
  }

  /**
   * Home-pair meetup: when both critters are free on the FRONT lane, they
   * wander over to each other, square up, chat in bubbles and hop.
   */
  private tryGreet(): void {
    if (this.walkers.length < 2) return;
    const [a, b] = this.walkers;
    if (a.busy || b.busy || a.lane !== 'front' || b.lane !== 'front') return;
    a.busy = b.busy = true;
    for (const w of [a, b]) {
      w.seq++;
      w.walkTween?.remove();
      w.bobTween?.remove();
      w.shadowTween?.remove();
      w.bobTween = undefined;
      // normalize in case a lane-transition glide was interrupted mid-tween
      w.img.setScale(this.scaleFor(w, 'front'));
      w.img.y = this.laneY('front');
      w.shadow.setPosition(w.img.x, this.laneY('front'));
      w.shadow.setScale(1, 1);
    }

    const { left, right } = this.opts;
    const mid = Phaser.Math.Clamp((a.img.x + b.img.x) / 2, left + 90, right - 90);
    const aLeft = a.img.x <= b.img.x;
    let arrived = 0;
    const meet = () => {
      if (++arrived < 2) return;
      // square up and chat
      const aFacesLeft = b.img.x < a.img.x;
      a.img.setFlipX(ART_FACES_LEFT ? !aFacesLeft : aFacesLeft);
      b.img.setFlipX(ART_FACES_LEFT ? aFacesLeft : !aFacesLeft);
      this.bubble(a, Math.random() < 0.5 ? 'heart' : 'note');
      this.later(a, 350, () => this.bubble(b, Math.random() < 0.5 ? 'happy' : 'note'));
      this.hop(Math.random() < 0.5 ? a : b);
      this.later(a, 1900, () => {
        a.busy = b.busy = false;
        a.seq++;
        b.seq++;
        this.next(a);
        this.next(b);
      });
    };
    this.walkTo(a, Math.round(mid + (aLeft ? -36 : 36)), 'front', meet);
    this.walkTo(b, Math.round(mid + (aLeft ? 36 : -36)), 'front', meet);
  }
}
