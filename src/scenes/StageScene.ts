import Phaser from 'phaser';
import { SpeciesDef, speciesById } from '../data/species';
import { generateStage, StageDef, StageTheme, STAGE_THEMES, STAGE_LENGTH } from '../data/stages';
import { CritterInstance, gameState } from '../state/GameState';
import { badgeName, effectiveness } from '../data/typeChart';
import { BattleStats, battleStats, wildStats, damageRoll, xpFromKill, applyXp } from '../battle/stats';
import { cooldownMs, MoveDef, movesForSpecies } from '../battle/moves';
import { playMusic, stopMusic, sfx } from '../audio/audio';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { seededRng } from '../util/daily';

const WORLD_W = 720;
const ROW_H = 16;
const ENGAGE_RANGE = 470;
const DASH_LEN = 230;
const DASH_MS = 170;
const DASH_CD = 600;
const CAPTURE_CHANCE = 0.2;
const MISS_CHANCE = 0.45;

interface PathRow {
  cx: number;
  half: number;
  jitter: number;
}

interface Fighter {
  inst: CritterInstance;
  sp: SpeciesDef;
  stats: BattleStats;
  hp: number;
  moves: MoveDef[];
}

interface Enemy {
  sp: SpeciesDef;
  types: string[];
  img: Phaser.GameObjects.Image;
  level: number;
  stats: BattleStats;
  hp: number;
  maxHp: number;
  group: number;
  boss: boolean;
  rare: boolean;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  wanderAt: number;
  nextContact: number;
  nextAttack: number;
  telegraphUntil: number;
  lungeUntil: number;
  lungeVx: number;
  lungeVy: number;
  lungeHit: boolean;
  alert: Phaser.GameObjects.Text;
  fx: number;
  fy: number;
  burnUntil: number;
  burnNext: number;
  poisonUntil: number;
  poisonNext: number;
  rootUntil: number;
  soakUntil: number;
  atkDownUntil: number;
  accDownUntil: number;
  stunUntil: number;
  slowUntil: number;
  charmUntil: number;
  scrambleUntil: number;
  curseAt: number;
  curseMove?: MoveDef;
  kbx: number;
  kby: number;
  dead: boolean;
}

interface Lob {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  move: MoveDef;
  img: Phaser.GameObjects.Rectangle;
}

interface Patch {
  x: number;
  y: number;
  until: number;
  nextTick: number;
  move: MoveDef;
  poison: boolean;
}

interface Wave {
  x: number;
  y: number;
  dirY: number;
  until: number;
  move: MoveDef;
  hit: Set<Enemy>;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  atk: number;
  blind: boolean;
  gone: boolean;
}

interface PBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  move: MoveDef;
  scale: number;
  homing: number;
  range: number;
  traveled: number;
  color: number;
  gone: boolean;
}

interface Weed {
  x: number;
  y: number;
  vx: number;
  spin: number;
  hit: boolean;
  gone: boolean;
}

interface Drop {
  x: number;
  y: number;
  impactAt: number;
  done: boolean;
}

interface Fx {
  kind: 'line' | 'circle' | 'ring' | 'cone';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  dir?: number;
  spread?: number;
  width?: number;
  color: number;
  born: number;
  until: number;
}

/**
 * A generated stage - the Rumble-style core loop, rebuilt on a WORLD
 * CONTAINER: the world scrolls, the camera never moves, and all UI lives
 * in plain screen space (fixes the scrollFactor input bugs). The trail
 * winds left and right up the stage with pixel-staircase walls contoured
 * to the corridor. All 17 types' moves, statuses, and per-theme hazards.
 */
export class StageScene extends Phaser.Scene {
  private def!: StageDef;
  private theme!: StageTheme;
  private path: PathRow[] = [];
  private world!: Phaser.GameObjects.Container;
  private entityLayer!: Phaser.GameObjects.Container;
  private topLayer!: Phaser.GameObjects.Container;
  private shadowG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private barG!: Phaser.GameObjects.Graphics;
  private team: Fighter[] = [];
  private activeIdx = 0;
  private playerImg!: Phaser.GameObjects.Image;
  private enemies: Enemy[] = [];
  private lobs: Lob[] = [];
  private patches: Patch[] = [];
  private waves: Wave[] = [];
  private bullets: Bullet[] = [];
  private pBullets: PBullet[] = [];
  private weeds: Weed[] = [];
  private drops: Drop[] = [];
  private slicks: { x: number; y: number; r: number }[] = [];
  private nextHazardAt = 0;
  private fxList: Fx[] = [];
  private cooldownAt: number[] = [0, 0];
  private pendingBeam?: { fireAt: number; dir: { x: number; y: number }; move: MoveDef };
  private channel?: { idx: number; move: MoveDef; start: number; dir: { x: number; y: number } };
  private shieldUntil = 0;
  private hasteUntil = 0;
  private selfStunUntil = 0;
  private dashUntil = 0;
  private dashCdAt = 0;
  private dashVx = 0;
  private dashVy = 0;
  private dashHit?: Set<Enemy>;
  private dashMove?: MoveDef;
  private swipeStart?: { x: number; y: number };
  private groupRevealed: boolean[] = [];
  private bossRevealed = false;
  private over = false;
  private pendingClear = false;
  private hudHpG!: Phaser.GameObjects.Graphics;
  private hudName!: Phaser.GameObjects.Text;
  private hudLv!: Phaser.GameObjects.Text;
  private hudFace!: Phaser.GameObjects.Image;
  private reserveFaces: Phaser.GameObjects.Image[] = [];
  private goldText!: Phaser.GameObjects.Text;
  private goldEarned = 0;
  private pips: Phaser.GameObjects.Rectangle[] = [];
  private moveBtns: {
    move: MoveDef;
    face: Phaser.GameObjects.Rectangle;
    cdG: Phaser.GameObjects.Graphics;
    parts: Phaser.GameObjects.GameObject[];
  }[] = [];
  private toastQueue: { sp: SpeciesDef; isNew: boolean }[] = [];
  private toastBusy = false;
  private seenThisStage = new Set<string>();

  constructor() {
    super('Stage');
  }

  init(data: { seed: string; themeId: string }): void {
    this.def = generateStage(data.seed, data.themeId);
    this.theme = STAGE_THEMES[this.def.themeId] ?? STAGE_THEMES.prairie;
    this.path = [];
    this.team = [];
    this.activeIdx = 0;
    this.enemies = [];
    this.lobs = [];
    this.patches = [];
    this.waves = [];
    this.bullets = [];
    this.pBullets = [];
    this.weeds = [];
    this.drops = [];
    this.slicks = [];
    this.nextHazardAt = 0;
    this.fxList = [];
    this.cooldownAt = [0, 0];
    this.pendingBeam = undefined;
    this.channel = undefined;
    this.shieldUntil = 0;
    this.hasteUntil = 0;
    this.selfStunUntil = 0;
    this.dashUntil = 0;
    this.dashCdAt = 0;
    this.dashHit = undefined;
    this.dashMove = undefined;
    this.swipeStart = undefined;
    this.groupRevealed = this.def.groups.map(() => false);
    this.bossRevealed = false;
    this.over = false;
    this.pendingClear = false;
    this.reserveFaces = [];
    this.goldEarned = 0;
    this.pips = [];
    this.moveBtns = [];
    this.toastQueue = [];
    this.toastBusy = false;
    this.seenThisStage = new Set();
  }

  create(): void {
    ensureIcons(this);
    this.cameras.main.setBackgroundColor(this.theme.wall);

    this.buildTeam();
    if (this.team.length === 0) {
      this.scene.start('Map');
      return;
    }
    this.buildPath();

    // the scrolling world: bg, shadows, entities, then fx/bars on top
    this.world = this.add.container(0, 0);
    const bgG = this.add.graphics();
    this.world.add(bgG);
    this.drawBackground(bgG);
    this.shadowG = this.add.graphics();
    this.world.add(this.shadowG);
    this.entityLayer = this.add.container(0, 0);
    this.world.add(this.entityLayer);
    this.topLayer = this.add.container(0, 0);
    this.world.add(this.topLayer);
    this.fxG = this.add.graphics();
    this.barG = this.add.graphics();
    this.topLayer.add(this.fxG);
    this.topLayer.add(this.barG);

    this.spawnAll();

    const active = this.team[this.activeIdx];
    const texKey = this.textures.exists(active.sp.textureKey) ? active.sp.textureKey : 'pl-unknown';
    const startY = STAGE_LENGTH - 240;
    this.playerImg = this.add.image(this.rowAt(startY).cx, startY, texKey).setDisplaySize(100, 100);
    this.entityLayer.add(this.playerImg);

    this.buildHud();
    this.buildMoveButtons();
    this.bindInput();

    playMusic('trail');
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      playMusic(this.bossRevealed ? 'showdown' : 'trail');
      if (this.pendingClear) this.stageClear();
    });
    this.scrollWorld();
  }

  // ---------- corridor path ----------

  private buildPath(): void {
    const rng = seededRng(`${this.def.seed}-path`);
    const rows = Math.ceil(STAGE_LENGTH / ROW_H);
    const wpGap = 340;
    const wpCount = Math.ceil(STAGE_LENGTH / wpGap) + 2;
    const wx: number[] = [];
    for (let i = 0; i < wpCount; i++) wx.push(230 + rng() * 260);
    // straight, centered stretches at the boss (top) and the start (bottom)
    wx[0] = 360;
    wx[1] = 360;
    wx[wpCount - 1] = 360;
    wx[wpCount - 2] = 360;
    for (let r = 0; r < rows; r++) {
      const y = r * ROW_H;
      const fi = y / wpGap;
      const i0 = Math.min(wpCount - 1, Math.floor(fi));
      const i1 = Math.min(wpCount - 1, i0 + 1);
      const t = fi - i0;
      const smooth = t * t * (3 - 2 * t);
      let cx = wx[i0] + (wx[i1] - wx[i0]) * smooth;
      let half = 200 + Math.sin(y * 0.0045) * 26;
      if (y < 760) half = Math.min(320, half + (760 - y) * 0.16); // boss arena bulge
      cx = Phaser.Math.Clamp(cx, half + 20, WORLD_W - half - 20);
      const jitter = (r * 2654435761) % 3 === 0 ? 8 : 0;
      this.path.push({ cx, half, jitter });
    }
  }

  private rowAt(y: number): PathRow {
    return this.path[Phaser.Math.Clamp(Math.floor(y / ROW_H), 0, this.path.length - 1)];
  }

  private clampX(x: number, y: number, margin: number): number {
    const r = this.rowAt(y);
    return Phaser.Math.Clamp(x, r.cx - r.half + margin, r.cx + r.half - margin);
  }

  private insideCorridor(x: number, y: number, margin: number): boolean {
    const r = this.rowAt(y);
    return x > r.cx - r.half + margin && x < r.cx + r.half - margin;
  }

  // ---------- background art ----------

  private drawBackground(g: Phaser.GameObjects.Graphics): void {
    const rng = seededRng(`${this.def.seed}-bg`);
    const t = this.theme;
    const rows = this.path.length;

    // corridor + contoured walls, row by row with staircase-quantized edges
    for (let r = 0; r < rows; r++) {
      const y = r * ROW_H;
      const row = this.path[r];
      const lx = Math.floor((row.cx - row.half + row.jitter) / 8) * 8;
      const rx = Math.ceil((row.cx + row.half - row.jitter) / 8) * 8;
      g.fillStyle(t.ground);
      g.fillRect(lx, y, rx - lx, ROW_H);
      const tq = Math.round(row.cx / 8) * 8;
      g.fillStyle(t.trail, 0.4);
      g.fillRect(tq - 56, y, 112, ROW_H);
      g.fillStyle(t.wall);
      g.fillRect(0, y, lx, ROW_H);
      g.fillRect(rx, y, WORLD_W - rx, ROW_H);
      g.fillStyle(t.wallEdge);
      g.fillRect(lx - 8, y, 8, ROW_H);
      g.fillRect(rx, y, 8, ROW_H);
      g.fillStyle(COLORS.ink, 0.45);
      g.fillRect(lx, y, 2, ROW_H);
      g.fillRect(rx - 2, y, 2, ROW_H);
    }

    // ground speckle inside the corridor
    g.fillStyle(t.groundDark);
    for (let i = 0; i < 420; i++) {
      const y = Math.floor(rng() * STAGE_LENGTH);
      const row = this.rowAt(y);
      const x = row.cx - row.half + 20 + rng() * (row.half * 2 - 40);
      g.fillRect(Math.floor(x / 4) * 4, Math.floor(y / 4) * 4, 4, 4);
    }

    // wall decoration + corridor-edge props, every ~120px
    for (let y = 120; y < STAGE_LENGTH - 120; y += 120) {
      const row = this.rowAt(y);
      this.drawWallDecor(g, row.cx - row.half - 26, y + rng() * 60, rng);
      this.drawWallDecor(g, row.cx + row.half + 26, y + 40 + rng() * 60, rng);
      if (rng() < 0.7) {
        const side = rng() < 0.5 ? row.cx - row.half + 48 + rng() * 40 : row.cx + row.half - 48 - rng() * 40;
        this.drawProp(g, side, y + rng() * 80, rng);
      }
    }

    // slick hazard zones are part of the terrain
    if (this.theme.hazard === 'slick') {
      const srng = seededRng(`${this.def.seed}-slick`);
      for (let i = 0; i < 4; i++) {
        const y = 700 + srng() * (STAGE_LENGTH - 1500);
        const row = this.rowAt(y);
        const x = row.cx - row.half * 0.5 + srng() * row.half;
        this.slicks.push({ x, y, r: 76 });
        const color = this.theme.id === 'water' ? 0x5f8aa8 : 0xd9c23b;
        g.fillStyle(COLORS.ink, 0.25);
        g.fillCircle(x, y, 80);
        g.fillStyle(color, 0.4);
        g.fillCircle(x, y, 74);
      }
    }
  }

  /** Two-tone blocky decor sitting ON the wall, hugging the corridor edge. */
  private drawWallDecor(g: Phaser.GameObjects.Graphics, x: number, y: number, rng: () => number): void {
    const t = this.theme;
    const qx = Math.floor(x / 4) * 4;
    const qy = Math.floor(y / 4) * 4;
    switch (t.id) {
      case 'grove': {
        g.fillStyle(0x3a5226);
        g.fillRect(qx - 22, qy - 18, 44, 36);
        g.fillStyle(0x557538);
        g.fillRect(qx - 16, qy - 24, 32, 24);
        break;
      }
      case 'creek': {
        g.fillStyle(COLORS.ink, 0.6);
        g.fillRect(qx - 18, qy - 10, 38, 26);
        g.fillStyle(0x8a857a);
        g.fillRect(qx - 16, qy - 12, 34, 24);
        g.fillStyle(0xa39e92);
        g.fillRect(qx - 10, qy - 16, 20, 12);
        break;
      }
      case 'water': {
        g.fillStyle(0xd9e6ee, 0.5);
        g.fillRect(qx - 16, qy, 12, 3);
        g.fillRect(qx + 2, qy + 8, 14, 3);
        break;
      }
      case 'ranch': {
        g.fillStyle(COLORS.ink, 0.5);
        g.fillRect(qx - 3, qy - 14, 8, 30);
        g.fillStyle(0x94714a);
        g.fillRect(qx - 2, qy - 12, 6, 26);
        break;
      }
      case 'flower': {
        const colors = [0xc75b4a, 0xd9b13b, 0x7a6bb5];
        g.fillStyle(colors[Math.floor(rng() * colors.length)]);
        g.fillRect(qx - 4, qy - 4, 8, 8);
        g.fillStyle(0xffffff, 0.6);
        g.fillRect(qx - 1, qy - 1, 3, 3);
        break;
      }
      default: {
        g.fillStyle(0x7d7833);
        g.fillRect(qx - 2, qy - 12, 5, 14);
        g.fillRect(qx + 6, qy - 8, 5, 10);
        g.fillRect(qx - 10, qy - 8, 5, 10);
      }
    }
  }

  /** Props inside the corridor: ink-outlined, hard-shadowed pixel objects. */
  private drawProp(g: Phaser.GameObjects.Graphics, x: number, y: number, rng: () => number): void {
    const qx = Math.floor(x / 4) * 4;
    const qy = Math.floor(y / 4) * 4;
    // hard offset shadow first
    g.fillStyle(COLORS.ink, 0.16);
    g.fillRect(qx - 12, qy + 14, 30, 6);
    switch (this.theme.prop) {
      case 'grass':
        g.fillStyle(0x76862f);
        g.fillRect(qx, qy - 4, 6, 20);
        g.fillRect(qx + 8, qy, 6, 16);
        g.fillRect(qx - 8, qy + 2, 6, 14);
        g.fillStyle(0x8a9a3f);
        g.fillRect(qx + 1, qy - 4, 2, 8);
        break;
      case 'flower': {
        const colors = [0xc75b4a, 0xd9b13b, 0x7a6bb5, 0xe0e0e0];
        g.fillStyle(0x5f7a34);
        g.fillRect(qx + 2, qy + 2, 4, 14);
        g.fillStyle(colors[Math.floor(rng() * colors.length)]);
        g.fillRect(qx - 3, qy - 6, 12, 12);
        g.fillStyle(0xffffff, 0.5);
        g.fillRect(qx, qy - 3, 4, 4);
        break;
      }
      case 'reed':
        g.fillStyle(0x3f6a48);
        g.fillRect(qx - 4, qy - 10, 4, 26);
        g.fillRect(qx + 4, qy - 16, 4, 32);
        g.fillStyle(0x5a8a5f);
        g.fillRect(qx + 4, qy - 16, 4, 8);
        break;
      case 'tree':
        g.fillStyle(COLORS.ink, 0.7);
        g.fillRect(qx - 24, qy - 26, 50, 44);
        g.fillStyle(0x4f7038);
        g.fillRect(qx - 22, qy - 24, 46, 40);
        g.fillStyle(0x5d8242);
        g.fillRect(qx - 14, qy - 30, 30, 20);
        g.fillStyle(0x5a4630);
        g.fillRect(qx - 4, qy + 12, 10, 14);
        break;
      case 'rock':
        g.fillStyle(COLORS.ink, 0.7);
        g.fillRect(qx - 16, qy - 6, 34, 26);
        g.fillStyle(0x8d8a80);
        g.fillRect(qx - 14, qy - 8, 30, 26);
        g.fillStyle(0xa5a298);
        g.fillRect(qx - 8, qy - 12, 18, 12);
        break;
      case 'fence':
        g.fillStyle(COLORS.ink, 0.6);
        g.fillRect(qx - 34, qy + 4, 72, 6);
        g.fillStyle(0x6b4a2b);
        g.fillRect(qx - 34, qy - 6, 6, 22);
        g.fillRect(qx - 2, qy - 6, 6, 22);
        g.fillRect(qx + 30, qy - 6, 6, 22);
        g.fillStyle(0x8a6238);
        g.fillRect(qx - 32, qy + 2, 68, 4);
        break;
    }
  }

  // ---------- team + spawns ----------

  private buildTeam(): void {
    const herd = gameState.data.herd;
    const posse = gameState.data.teams[gameState.data.activeTeam];
    const uids = posse ? posse.members.filter((m): m is string => !!m) : [];
    let members = uids
      .map((uid) => herd.find((c) => c.uid === uid))
      .filter((c): c is CritterInstance => !!c);
    if (members.length === 0) members = herd.slice(0, 3);
    this.team = members.slice(0, 3).map((inst) => {
      const sp = speciesById(inst.speciesId);
      const stats = battleStats(sp, inst.pedigree, inst.level);
      return { inst, sp, stats, hp: stats.hp, moves: movesForSpecies(sp) };
    });
  }

  private spawnAll(): void {
    const rng = seededRng(`${this.def.seed}-spawn`);
    const offsets = [
      [0, 0],
      [-120, 60],
      [120, 60],
      [-64, -84],
      [64, -84]
    ];
    this.def.groups.forEach((grp, gi) => {
      const cx = this.rowAt(grp.y).cx;
      const total = grp.count + (grp.rareId ? 1 : 0);
      for (let i = 0; i < total; i++) {
        const isRare = !!grp.rareId && i === 0;
        const spId = isRare ? (grp.rareId as string) : grp.speciesId;
        const [ox, oy] = offsets[i % offsets.length];
        this.spawnEnemy(spId, cx + ox + rng() * 20 - 10, grp.y + oy, grp.level, gi, false, isRare);
      }
    });
    this.spawnEnemy(this.def.bossId, this.rowAt(430).cx, 430, this.def.bossLevel, this.def.groups.length, true, false);
  }

  private spawnEnemy(spId: string, x: number, y: number, level: number, group: number, boss: boolean, rare: boolean): void {
    const sp = speciesById(spId);
    const stats = wildStats(sp, level);
    const maxHp = Math.round(stats.hp * (boss ? 3.2 : 1));
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const size = boss ? 170 : rare ? 112 : 92;
    const px = this.clampX(x, y, 40);
    const img = this.add.image(px, y, texKey).setDisplaySize(size, size);
    this.entityLayer.add(img);
    if (rare) img.setTint(0xffe9a0);
    const alert = this.add
      .text(px, y - size / 2 - 22, '!', { fontFamily: FONT.ui, fontSize: '32px', color: HEX.wantedRed })
      .setOrigin(0.5)
      .setVisible(false);
    this.topLayer.add(alert);
    this.enemies.push({
      sp,
      types: [sp.type1, sp.type2].filter((t): t is string => !!t).map(badgeName),
      img,
      level,
      stats,
      hp: maxHp,
      maxHp,
      group,
      boss,
      rare,
      homeX: px,
      homeY: y,
      targetX: px,
      targetY: y,
      wanderAt: 0,
      nextContact: 0,
      nextAttack: this.time.now + 2500 + Math.random() * 2000,
      telegraphUntil: 0,
      lungeUntil: 0,
      lungeVx: 0,
      lungeVy: 0,
      lungeHit: false,
      alert,
      fx: 0,
      fy: 1,
      burnUntil: 0,
      burnNext: 0,
      poisonUntil: 0,
      poisonNext: 0,
      rootUntil: 0,
      soakUntil: 0,
      atkDownUntil: 0,
      accDownUntil: 0,
      stunUntil: 0,
      slowUntil: 0,
      charmUntil: 0,
      scrambleUntil: 0,
      curseAt: 0,
      kbx: 0,
      kby: 0,
      dead: false
    });
  }

  // ---------- HUD (plain screen space - no scrollFactor anywhere) ----------

  private buildHud(): void {
    const { width } = this.scale;
    const g = this.add.graphics();
    drawPixelPanel(g, 12, 12, 320, 96, COLORS.parchmentLight, COLORS.saddle, 4);
    this.hudFace = this.add.image(52, 60, 'pl-unknown').setDisplaySize(60, 60);
    this.hudName = this.add.text(92, 26, '', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink });
    this.hudLv = this.add
      .text(322, 26, '', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
      .setOrigin(1, 0);
    this.hudHpG = this.add.graphics();
    for (let i = 0; i < 2; i++) {
      this.reserveFaces.push(this.add.image(360 + i * 56, 44, 'pl-unknown').setDisplaySize(44, 44).setVisible(false));
    }
    this.add.image(width - 210, 36, 'icon-coin').setTint(COLORS.brass).setScale(0.7);
    this.goldText = this.add
      .text(width - 188, 36, '+0', { fontFamily: FONT.ui, fontSize: '20px', color: HEX.brass })
      .setOrigin(0, 0.5);
    makeButton(this, width - 76, 40, 110, 48, 'FLEE', () => this.quit(), '18px');
    const total = this.def.groups.length + 1;
    for (let i = 0; i < total; i++) {
      this.pips.push(
        this.add
          .rectangle(width / 2 - (total * 26) / 2 + i * 26 + 8, 126, i === total - 1 ? 20 : 14, 14, COLORS.parchmentDark)
          .setStrokeStyle(2, COLORS.saddle)
      );
    }
    this.refreshHud();
  }

  private refreshHud(): void {
    const f = this.team[this.activeIdx];
    if (!f) return;
    const texKey = this.textures.exists(f.sp.textureKey) ? f.sp.textureKey : 'pl-unknown';
    this.hudFace.setTexture(texKey).setDisplaySize(60, 60);
    this.hudName.setText(f.sp.name.toUpperCase());
    this.hudLv.setText(`LV ${f.inst.level}`);
    this.hudHpG.clear();
    this.hudHpG.fillStyle(COLORS.ink);
    this.hudHpG.fillRect(90, 52, 216, 20);
    this.hudHpG.fillStyle(COLORS.parchmentDark);
    this.hudHpG.fillRect(92, 54, 212, 16);
    const frac = Phaser.Math.Clamp(f.hp / f.stats.hp, 0, 1);
    this.hudHpG.fillStyle(frac > 0.35 ? COLORS.sage : COLORS.adobeRed);
    this.hudHpG.fillRect(92, 54, Math.round(212 * frac), 16);
    let ri = 0;
    this.team.forEach((m, i) => {
      if (i === this.activeIdx) return;
      const face = this.reserveFaces[ri++];
      if (!face) return;
      const key = this.textures.exists(m.sp.textureKey) ? m.sp.textureKey : 'pl-unknown';
      face.setTexture(key).setDisplaySize(44, 44).setVisible(true).setAlpha(m.hp > 0 ? 1 : 0.3);
    });
    for (; ri < this.reserveFaces.length; ri++) this.reserveFaces[ri].setVisible(false);
    this.def.groups.forEach((grp, gi) => {
      if (this.enemies.filter((e) => e.group === gi).every((e) => e.dead)) this.pips[gi].setFillStyle(COLORS.sage);
    });
  }

  private buildMoveButtons(): void {
    for (const b of this.moveBtns) b.parts.forEach((p) => p.destroy());
    this.moveBtns = [];
    const { width, height } = this.scale;
    const f = this.team[this.activeIdx];
    if (!f) return;
    const moves = f.moves.slice(0, 2);
    const by = height - 96;
    moves.forEach((move, i) => {
      const bx = moves.length === 1 ? width / 2 : width / 2 + (i - 0.5) * 250;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const shadow = this.add.rectangle(bx, by + 5, 230, 120, COLORS.ink);
      const face = this.add.rectangle(bx, by, 230, 120, COLORS.saddle).setStrokeStyle(2, COLORS.ink);
      const badgeKey = `type-${move.type}`;
      if (this.textures.exists(badgeKey)) {
        parts.push(this.add.image(bx, by - 32, badgeKey).setScale(2));
      }
      const label = this.add
        .text(bx, by + 18, move.name, {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.parchment,
          align: 'center',
          wordWrap: { width: 210 }
        })
        .setOrigin(0.5);
      const cdG = this.add.graphics();
      face.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pressMove(i));
      parts.push(shadow, face, label, cdG);
      this.moveBtns.push({ move, face, cdG, parts });
    });
  }

  private bindInput(): void {
    const { height } = this.scale;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > height - 170) return;
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.channel) {
        this.releaseChannel(this.time.now);
        this.swipeStart = undefined;
        return;
      }
      if (!this.swipeStart || this.over) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = undefined;
      const len = Math.hypot(dx, dy);
      if (len < 48 || this.time.now < this.dashCdAt || this.time.now < this.selfStunUntil) return;
      this.startDash(dx / len, dy / len, DASH_LEN, undefined);
    });
  }

  private startDash(nx: number, ny: number, len: number, move: MoveDef | undefined): void {
    this.dashUntil = this.time.now + DASH_MS;
    this.dashCdAt = this.time.now + DASH_CD;
    this.dashVx = (nx * len) / (DASH_MS / 1000);
    this.dashVy = (ny * len) / (DASH_MS / 1000);
    this.dashMove = move;
    this.dashHit = move ? new Set() : undefined;
    sfx('dash');
  }

  // ---------- update loop ----------

  update(time: number, deltaMs: number): void {
    if (this.over || this.team.length === 0) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.fxG.clear();

    this.updatePlayer(time, dt);
    this.updateEnemies(time, dt);
    this.updateProjectiles(time, dt);
    this.updateBeam(time);
    this.updateHazards(time, dt);
    this.drawChannel(time);
    this.drawFx(time);
    this.drawShadows();
    this.drawEnemyBars(time);
    this.updateCooldownOverlays(time);
    this.checkReveals();
    this.scrollWorld();
  }

  private scrollWorld(): void {
    const { height } = this.scale;
    const scroll = Phaser.Math.Clamp(this.playerImg.y - height * 0.62, 0, STAGE_LENGTH - height);
    this.world.y = -scroll;
  }

  private nearestEnemy(maxDist: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(this.playerImg.x, this.playerImg.y, e.img.x, e.img.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private updatePlayer(time: number, dt: number): void {
    const f = this.team[this.activeIdx];
    const img = this.playerImg;
    const stunned = time < this.selfStunUntil;
    if (time < this.dashUntil) {
      img.x += this.dashVx * dt;
      img.y += this.dashVy * dt;
      if (this.dashMove && this.dashHit) {
        for (const e of this.enemies) {
          if (e.dead || this.dashHit.has(e)) continue;
          if (Phaser.Math.Distance.Between(img.x, img.y, e.img.x, e.img.y) < 80) {
            this.dashHit.add(e);
            this.applyHit(e, this.dashMove, 1);
          }
        }
      }
    } else if (!stunned && !this.channel) {
      this.dashMove = undefined;
      let speed = Phaser.Math.Clamp(130 + f.stats.spe * 0.6, 130, 260);
      if (time < this.hasteUntil) speed *= 1.35;
      for (const s of this.slicks) {
        if (Phaser.Math.Distance.Between(img.x, img.y, s.x, s.y) < s.r) speed *= 0.55;
      }
      const near = this.nearestEnemy(ENGAGE_RANGE);
      if (near) {
        const d = Phaser.Math.Distance.Between(img.x, img.y, near.img.x, near.img.y);
        if (d > 150) {
          img.x += ((near.img.x - img.x) / d) * speed * 0.8 * dt;
          img.y += ((near.img.y - img.y) / d) * speed * 0.8 * dt;
        }
      } else {
        img.y -= speed * dt;
        img.x += (this.rowAt(img.y).cx - img.x) * 1.4 * dt;
      }
    }
    // never pass an uncleared group
    for (let gi = 0; gi < this.def.groups.length; gi++) {
      if (this.enemies.some((e) => e.group === gi && !e.dead)) {
        img.y = Math.max(img.y, this.def.groups[gi].y - 90);
        break;
      }
    }
    img.y = Phaser.Math.Clamp(img.y, 330, STAGE_LENGTH - 60);
    img.x = this.clampX(img.x, img.y, 40);
  }

  private updateEnemies(time: number, dt: number): void {
    const px = this.playerImg.x;
    const py = this.playerImg.y;
    const f = this.team[this.activeIdx];
    for (const e of this.enemies) {
      if (e.dead) continue;
      // damage-over-time ticks
      if (e.burnUntil > time && time > e.burnNext) {
        e.burnNext = time + 500;
        e.hp -= Math.max(1, Math.round(e.maxHp * 0.02));
        this.popup(e.img.x, e.img.y - 30, 'BURN', '#c75b4a');
      }
      if (e.poisonUntil > time && time > e.poisonNext) {
        e.poisonNext = time + 600;
        e.hp -= Math.max(1, Math.round(e.maxHp * 0.012));
        this.popup(e.img.x, e.img.y - 30, 'PSN', '#8a5aa0');
      }
      if (e.curseAt > 0 && time >= e.curseAt) {
        const cm = e.curseMove;
        e.curseAt = 0;
        if (cm) {
          this.popup(e.img.x, e.img.y - 46, 'CURSED!', '#7a6bb5');
          this.applyHit(e, cm, 1.3);
        }
      }
      if (e.hp <= 0) {
        this.killEnemy(e);
        continue;
      }
      if (Math.abs(e.kbx) > 4 || Math.abs(e.kby) > 4) {
        e.img.x += e.kbx * dt;
        e.img.y += e.kby * dt;
        e.kbx *= 0.82;
        e.kby *= 0.82;
      }
      const rooted = e.rootUntil > time || e.stunUntil > time;
      const dist = Phaser.Math.Distance.Between(px, py, e.img.x, e.img.y);
      const telegraphing = e.telegraphUntil > time;
      e.alert.setPosition(e.img.x, e.img.y - e.img.displayHeight / 2 - 22).setVisible(telegraphing);

      if (e.lungeUntil > time) {
        e.img.x += e.lungeVx * dt;
        e.img.y += e.lungeVy * dt;
        if (!e.lungeHit && dist < 86) {
          e.lungeHit = true;
          if (this.blindMiss(e, time)) this.popup(e.img.x, e.img.y - 30, 'MISS', '#9aa4ac');
          else this.hurtPlayer(damageRoll(e.level, 22, this.enemyAtk(e, time), f.stats.def, 1));
        }
      } else if (!rooted && !telegraphing) {
        const flip = e.scrambleUntil > time ? -1 : 1;
        const slowMult = e.slowUntil > time ? 0.5 : 1;
        let mx = 0;
        let my = 0;
        if (dist < 420) {
          const spd = Phaser.Math.Clamp(e.sp.moveSpeed * 0.55, 44, e.boss ? 90 : 140) * slowMult;
          if (dist > 60) {
            mx = ((px - e.img.x) / dist) * spd * flip;
            my = ((py - e.img.y) / dist) * spd * flip;
          }
        } else {
          if (time > e.wanderAt) {
            e.wanderAt = time + 1300 + Math.random() * 900;
            e.targetX = e.homeX + Math.random() * 140 - 70;
            e.targetY = e.homeY + Math.random() * 140 - 70;
          }
          const d = Phaser.Math.Distance.Between(e.img.x, e.img.y, e.targetX, e.targetY);
          if (d > 8) {
            mx = ((e.targetX - e.img.x) / d) * 34 * slowMult;
            my = ((e.targetY - e.img.y) / d) * 34 * slowMult;
          }
        }
        e.img.x += mx * dt;
        e.img.y += my * dt;
        const ml = Math.hypot(mx, my);
        if (ml > 6) {
          e.fx = mx / ml;
          e.fy = my / ml;
        }
      }
      e.img.x = this.clampX(e.img.x, e.img.y, 34);

      // contact damage
      if (dist < (e.boss ? 105 : 70) && time > e.nextContact && e.stunUntil < time) {
        e.nextContact = time + 900;
        if (this.blindMiss(e, time)) this.popup(e.img.x, e.img.y - 30, 'MISS', '#9aa4ac');
        else {
          const mult = e.atkDownUntil > time ? 0.6 : 1;
          this.hurtPlayer(damageRoll(e.level, 14, e.stats.atk * mult, f.stats.def, 1));
        }
      }
      // telegraphed attack (charmed critters don't attack)
      const passive = e.charmUntil > time || e.stunUntil > time;
      if (dist < 500 && time > e.nextAttack && !telegraphing && e.lungeUntil < time && !passive) {
        e.telegraphUntil = time + 550;
        e.nextAttack = time + (e.boss ? 2300 : 3400) + Math.random() * 1600;
      }
      if (!telegraphing && e.telegraphUntil > 0 && time >= e.telegraphUntil) {
        e.telegraphUntil = 0;
        if (!passive) this.enemyAttack(e, time);
      }
    }
  }

  private blindMiss(e: Enemy, time: number): boolean {
    return e.accDownUntil > time && Math.random() < MISS_CHANCE;
  }

  private enemyAtk(e: Enemy, time: number): number {
    return e.atkDownUntil > time ? Math.round(e.stats.atk * 0.6) : e.stats.atk;
  }

  private enemyAttack(e: Enemy, time: number): void {
    const px = this.playerImg.x;
    const py = this.playerImg.y;
    const dx = px - e.img.x;
    const dy = py - e.img.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const blind = e.accDownUntil > time;
    if (e.boss) {
      sfx('boss');
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        this.bullets.push({
          x: e.img.x,
          y: e.img.y,
          vx: Math.cos(a) * 230,
          vy: Math.sin(a) * 230,
          level: e.level,
          atk: e.stats.spa,
          blind,
          gone: false
        });
      }
      return;
    }
    if ((e.sp.atkStyle ?? 'physical') === 'special') {
      sfx('lob');
      this.bullets.push({
        x: e.img.x,
        y: e.img.y,
        vx: (dx / d) * 260,
        vy: (dy / d) * 260,
        level: e.level,
        atk: e.stats.spa,
        blind,
        gone: false
      });
    } else {
      e.lungeUntil = time + 260;
      e.lungeVx = (dx / d) * 620;
      e.lungeVy = (dy / d) * 620;
      e.lungeHit = false;
      sfx('dash');
    }
  }

  private updateProjectiles(time: number, dt: number): void {
    const f = this.team[this.activeIdx];
    // enemy bullets (blocked by the corridor walls)
    for (const b of this.bullets) {
      if (b.gone) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!this.insideCorridor(b.x, b.y, 6) || Math.abs(b.y - this.playerImg.y) > 900) {
        b.gone = true;
        continue;
      }
      if (Phaser.Math.Distance.Between(b.x, b.y, this.playerImg.x, this.playerImg.y) < 44) {
        b.gone = true;
        if (b.blind && Math.random() < MISS_CHANCE) this.popup(this.playerImg.x, this.playerImg.y - 40, 'MISS', '#9aa4ac');
        else this.hurtPlayer(damageRoll(b.level, 22, b.atk, f.stats.spd, 1));
      }
    }
    this.bullets = this.bullets.filter((b) => !b.gone);

    // player projectiles
    for (const b of this.pBullets) {
      if (b.gone) continue;
      if (b.homing > 0) {
        const near = this.nearestEnemyTo(b.x, b.y, 480);
        if (near) {
          const want = Math.atan2(near.img.y - b.y, near.img.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const diff = Phaser.Math.Angle.Wrap(want - cur);
          const turn = Phaser.Math.Clamp(diff, -b.homing * dt, b.homing * dt);
          const spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(cur + turn) * spd;
          b.vy = Math.sin(cur + turn) * spd;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.traveled += Math.hypot(b.vx, b.vy) * dt;
      if (b.traveled > b.range || !this.insideCorridor(b.x, b.y, 6)) {
        b.gone = true;
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Phaser.Math.Distance.Between(b.x, b.y, e.img.x, e.img.y) < 40) {
          b.gone = true;
          if (b.move.behavior === 'curseOrb') {
            e.curseAt = time + (b.move.curseDelayS ?? 3) * 1000;
            e.curseMove = b.move;
            this.popup(e.img.x, e.img.y - 40, 'MARKED', '#7a6bb5');
            sfx('tether');
          } else {
            let scale = b.scale;
            if (b.move.critChance && Math.random() < b.move.critChance) {
              scale *= b.move.critMult ?? 1.5;
              this.popup(e.img.x, e.img.y - 52, 'CRIT!', '#e8d24a');
            }
            this.applyHit(e, b.move, scale);
          }
          break;
        }
      }
    }
    this.pBullets = this.pBullets.filter((b) => !b.gone);

    // lobbed shots
    for (const lob of this.lobs) {
      lob.t += dt / 0.7;
      const t = Math.min(1, lob.t);
      lob.x = lob.fromX + (lob.toX - lob.fromX) * t;
      lob.y = lob.fromY + (lob.toY - lob.fromY) * t - Math.sin(Math.PI * t) * 130;
      lob.img.setPosition(lob.x, lob.y);
      if (t >= 1) {
        lob.img.destroy();
        sfx('burst');
        if (lob.move.behavior === 'lobPatch') {
          this.patches.push({
            x: lob.toX,
            y: lob.toY,
            until: time + (lob.move.patchS ?? 3) * 1000,
            nextTick: 0,
            move: lob.move,
            poison: false
          });
        } else {
          this.fxList.push({ kind: 'circle', x: lob.toX, y: lob.toY, r: lob.move.burstR ?? 110, color: 0x8fae5a, born: time, until: time + 260 });
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (Phaser.Math.Distance.Between(lob.toX, lob.toY, e.img.x, e.img.y) < (lob.move.burstR ?? 110) + 30) {
              this.applyHit(e, lob.move, 1);
            }
          }
        }
      }
    }
    this.lobs = this.lobs.filter((l) => l.t < 1);

    // lingering ground zones (fire patches + poison clouds)
    for (const p of this.patches) {
      if (time > p.nextTick) {
        p.nextTick = time + 500;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Phaser.Math.Distance.Between(p.x, p.y, e.img.x, e.img.y) < 100) {
            this.applyHit(e, p.move, 0.3, true);
            if (p.poison) e.poisonUntil = Math.max(e.poisonUntil, time + 1400);
          }
        }
      }
    }
    this.patches = this.patches.filter((p) => p.until > time);

    // flood waves
    for (const w of this.waves) {
      w.y += w.dirY * 150 * dt;
      for (const e of this.enemies) {
        if (e.dead || w.hit.has(e)) continue;
        if (Math.abs(e.img.y - w.y) < 34 && Math.abs(e.img.x - w.x) < 170) {
          w.hit.add(e);
          e.soakUntil = time + (w.move.soakS ?? 4) * 1000;
          this.applyHit(e, w.move, 1);
        }
      }
    }
    this.waves = this.waves.filter((w) => w.until > time);
  }

  private nearestEnemyTo(x: number, y: number, maxDist: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.img.x, e.img.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private updateBeam(time: number): void {
    const b = this.pendingBeam;
    if (!b || time < b.fireAt) return;
    this.pendingBeam = undefined;
    sfx('zap');
    this.fireBeam(b.dir, b.move, 1, 900, 44);
  }

  private fireBeam(dir: { x: number; y: number }, move: MoveDef, scale: number, length: number, halfW: number): void {
    const time = this.time.now;
    const ox = this.playerImg.x;
    const oy = this.playerImg.y;
    this.fxList.push({
      kind: 'line',
      x: ox,
      y: oy,
      x2: ox + dir.x * length,
      y2: oy + dir.y * length,
      width: Math.round(halfW / 3),
      color: move.type === 'Dragon' ? 0xc75b4a : 0xe8d24a,
      born: time,
      until: time + 240
    });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const relX = e.img.x - ox;
      const relY = e.img.y - oy;
      const t = relX * dir.x + relY * dir.y;
      if (t < 0 || t > length) continue;
      const perp = Math.abs(relX * dir.y - relY * dir.x);
      if (perp < halfW) this.applyHit(e, move, scale);
    }
  }

  // ---------- hazards ----------

  private updateHazards(time: number, dt: number): void {
    const kind = this.theme.hazard;
    if (kind === 'slick') return; // static zones handled in movement
    if (this.nextHazardAt === 0) this.nextHazardAt = time + 4000;
    if (time > this.nextHazardAt) {
      this.nextHazardAt = time + 3800 + Math.random() * 2200;
      const py = this.playerImg.y;
      if (kind === 'tumbleweed') {
        const y = py - 320 - Math.random() * 160;
        const row = this.rowAt(y);
        const fromLeft = Math.random() < 0.5;
        this.weeds.push({
          x: fromLeft ? row.cx - row.half + 10 : row.cx + row.half - 10,
          y,
          vx: (fromLeft ? 1 : -1) * (160 + Math.random() * 60),
          spin: 0,
          hit: false,
          gone: false
        });
      } else {
        this.drops.push({
          x: this.playerImg.x + Math.random() * 120 - 60,
          y: py - 40 - Math.random() * 80,
          impactAt: time + 850,
          done: false
        });
      }
    }
    const hazardDmg = Math.max(2, Math.round(4 + this.def.groups[0].level * 1.6));
    for (const w of this.weeds) {
      if (w.gone) continue;
      w.x += w.vx * dt;
      w.spin += dt * 10;
      if (!this.insideCorridor(w.x, w.y, -60)) {
        w.gone = true;
        continue;
      }
      if (!w.hit && Phaser.Math.Distance.Between(w.x, w.y, this.playerImg.x, this.playerImg.y) < 46) {
        w.hit = true;
        this.hurtPlayer(hazardDmg);
      }
    }
    this.weeds = this.weeds.filter((w) => !w.gone);
    for (const d of this.drops) {
      if (d.done || time < d.impactAt) continue;
      d.done = true;
      sfx('burst');
      this.fxList.push({ kind: 'circle', x: d.x, y: d.y, r: 80, color: this.theme.id === 'grove' ? 0x6a8842 : 0x8d8a80, born: time, until: time + 280 });
      if (Phaser.Math.Distance.Between(d.x, d.y, this.playerImg.x, this.playerImg.y) < 85) {
        this.hurtPlayer(hazardDmg + 3);
      }
    }
    this.drops = this.drops.filter((d) => !d.done);
  }

  // ---------- moves ----------

  private pressMove(i: number): void {
    if (this.over) return;
    const time = this.time.now;
    if (time < this.cooldownAt[i]) return;
    const f = this.team[this.activeIdx];
    const move = f.moves[i];
    if (!move) return;
    if (move.behavior === 'channelBeam') {
      if (this.channel) return;
      this.channel = { idx: i, move, start: time, dir: this.aimDir() };
      sfx('beam');
      return;
    }
    this.cooldownAt[i] = time + cooldownMs(move);
    this.executeMove(move);
  }

  private aimDir(): { x: number; y: number } {
    const near = this.nearestEnemy(700);
    if (!near) return { x: 0, y: -1 };
    const d = Math.max(1, Phaser.Math.Distance.Between(this.playerImg.x, this.playerImg.y, near.img.x, near.img.y));
    return { x: (near.img.x - this.playerImg.x) / d, y: (near.img.y - this.playerImg.y) / d };
  }

  private releaseChannel(time: number): void {
    const c = this.channel;
    if (!c) return;
    this.channel = undefined;
    const maxS = c.move.channelMaxS ?? 1.2;
    const held = Phaser.Math.Clamp((time - c.start) / 1000, 0.15, maxS);
    const frac = held / maxS;
    this.cooldownAt[c.idx] = time + cooldownMs(c.move);
    sfx('zap');
    this.fireBeam(this.aimDir(), c.move, 0.5 + frac, 350 + frac * 550, 20 + frac * 34);
  }

  private drawChannel(time: number): void {
    const c = this.channel;
    if (!c) return;
    c.dir = this.aimDir();
    const maxS = c.move.channelMaxS ?? 1.2;
    const frac = Phaser.Math.Clamp((time - c.start) / 1000 / maxS, 0, 1);
    const len = 350 + frac * 550;
    this.fxG.lineStyle(4 + frac * 20, 0xc75b4a, 0.45);
    this.fxG.lineBetween(
      this.playerImg.x,
      this.playerImg.y,
      this.playerImg.x + c.dir.x * len,
      this.playerImg.y + c.dir.y * len
    );
  }

  private executeMove(move: MoveDef): void {
    const time = this.time.now;
    const dir = this.aimDir();
    const dx = dir.x;
    const dy = dir.y;
    const ox = this.playerImg.x;
    const oy = this.playerImg.y;
    const ang = Math.atan2(dy, dx);
    const near = this.nearestEnemy(700);

    switch (move.behavior) {
      case 'melee': {
        sfx('punch');
        const spread = move.spread ?? 1;
        this.fxList.push({ kind: 'cone', x: ox, y: oy, dir: ang, spread, r: move.range, color: 0xf0e2c2, born: time, until: time + 160 });
        const targets = this.coneTargets(ox, oy, dx, dy, move.range, spread);
        const list = move.aoe ? targets : targets.slice(0, 1);
        for (const e of list) {
          let scale = 1;
          if (move.backBonus) {
            const toEnemyX = (e.img.x - ox) / Math.max(1, Phaser.Math.Distance.Between(ox, oy, e.img.x, e.img.y));
            const toEnemyY = (e.img.y - oy) / Math.max(1, Phaser.Math.Distance.Between(ox, oy, e.img.x, e.img.y));
            if (toEnemyX * e.fx + toEnemyY * e.fy > 0.35) {
              scale *= move.backBonus;
              this.popup(e.img.x, e.img.y - 52, 'BACKSTAB!', '#e8d24a');
            }
          }
          this.applyHit(e, move, scale);
          this.applyOnHitEffects(e, move, time);
          if (move.hits && move.hits > 1) {
            this.time.delayedCall(160, () => {
              if (!e.dead && !this.over) this.applyHit(e, move, 1);
            });
          }
        }
        break;
      }
      case 'arc': {
        sfx('whip');
        this.fxList.push({ kind: 'cone', x: ox, y: oy, dir: ang, spread: move.spread ?? 1.1, r: move.range, color: 0xe8944a, born: time, until: time + 160 });
        for (const e of this.coneTargets(ox, oy, dx, dy, move.range, move.spread ?? 1.1)) {
          this.applyHit(e, move, 1);
          this.applyOnHitEffects(e, move, time);
        }
        break;
      }
      case 'conePush':
      case 'coneKnock': {
        sfx('wave');
        const spread = move.spread ?? 1;
        this.fxList.push({ kind: 'cone', x: ox, y: oy, dir: ang, spread, r: move.range, color: 0x9fc4d8, born: time, until: time + 180 });
        for (const e of this.coneTargets(ox, oy, dx, dy, move.range, spread)) {
          this.applyHit(e, move, 1);
          e.kbx = dx * (move.knockback ?? 130) * 3.2;
          e.kby = dy * (move.knockback ?? 130) * 3.2;
        }
        break;
      }
      case 'tether': {
        sfx('tether');
        const first = this.coneTargets(ox, oy, dx, dy, move.range, 0.3)[0];
        if (first) {
          this.fxList.push({ kind: 'line', x: ox, y: oy, x2: first.img.x, y2: first.img.y, color: 0x7c8b6f, born: time, until: time + 300 });
          this.applyHit(first, move, 1);
          first.rootUntil = time + (move.rootS ?? 1.5) * 1000;
          this.popup(first.img.x, first.img.y - 40, 'ROOTED', '#7c8b6f');
        }
        break;
      }
      case 'jabChain': {
        sfx('zap');
        const first = this.coneTargets(ox, oy, dx, dy, move.range, move.spread ?? 0.9)[0];
        if (first) {
          this.applyHit(first, move, 1);
          const chain = this.nearestEnemyToExcept(first.img.x, first.img.y, 180, first);
          if (chain) {
            this.fxList.push({ kind: 'line', x: first.img.x, y: first.img.y, x2: chain.img.x, y2: chain.img.y, color: 0xe8d24a, born: time, until: time + 200 });
            this.applyHit(chain, move, 0.5);
          }
        }
        break;
      }
      case 'beam': {
        sfx('beam');
        this.pendingBeam = { fireAt: time + (move.telegraphS ?? 0.45) * 1000, dir: { x: dx, y: dy }, move };
        this.fxList.push({ kind: 'line', x: ox, y: oy, x2: ox + dx * 900, y2: oy + dy * 900, width: 2, color: 0xe8d24a, born: time, until: time + (move.telegraphS ?? 0.45) * 1000 });
        break;
      }
      case 'dashLine': {
        this.startDash(dx, dy, move.dashLen ?? 260, move);
        break;
      }
      case 'lobPatch':
      case 'lobBurst': {
        sfx('lob');
        const tx = near ? near.img.x : ox + dx * move.range;
        const ty = near ? near.img.y : oy + dy * move.range;
        const img = this.add.rectangle(ox, oy, 16, 16, move.behavior === 'lobPatch' ? 0xc7683a : 0x6f9a4a);
        this.topLayer.add(img);
        this.lobs.push({ x: ox, y: oy, fromX: ox, fromY: oy, toX: tx, toY: ty, t: 0, move, img });
        break;
      }
      case 'radialDebuff':
      case 'swarmBurst': {
        sfx('holler');
        let scale = 1;
        if (move.behavior === 'swarmBurst') {
          const allies = this.team.filter(
            (m, i) =>
              i !== this.activeIdx &&
              m.hp > 0 &&
              [m.sp.type1, m.sp.type2].filter((t): t is string => !!t).map(badgeName).includes('Bug')
          ).length;
          scale = 1 + (move.allyBonus ?? 0.5) * allies;
        }
        this.fxList.push({ kind: 'ring', x: ox, y: oy, r: move.range, color: 0xf0e2c2, born: time, until: time + 300 });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Phaser.Math.Distance.Between(ox, oy, e.img.x, e.img.y) < move.range + 30) {
            this.applyHit(e, move, scale);
            if (move.atkDownS) e.atkDownUntil = time + move.atkDownS * 1000;
          }
        }
        break;
      }
      case 'wave': {
        sfx('wave');
        this.waves.push({ x: ox, y: oy - 40, dirY: dy < 0 ? -1 : 1, until: time + 2400, move, hit: new Set() });
        break;
      }
      case 'selfCircle': {
        sfx('burst');
        this.cameras.main.shake(120, 0.006);
        this.fxList.push({ kind: 'ring', x: ox, y: oy, r: move.range, color: 0xb0a068, born: time, until: time + 320 });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Phaser.Math.Distance.Between(ox, oy, e.img.x, e.img.y) < move.range + 30) this.applyHit(e, move, 1);
        }
        this.selfStunUntil = time + (move.selfStunS ?? 0.8) * 1000;
        break;
      }
      case 'expandCone': {
        sfx('wave');
        this.fxList.push({ kind: 'cone', x: ox, y: oy, dir: ang, spread: move.spread ?? 0.9, r: move.range, color: 0xc9b98a, born: time, until: time + 420 });
        for (const e of this.coneTargets(ox, oy, dx, dy, move.range, move.spread ?? 0.9)) {
          this.applyHit(e, move, 1);
          e.accDownUntil = time + (move.accDownS ?? 4) * 1000;
          this.popup(e.img.x, e.img.y - 44, 'BLINDED', '#c9b98a');
        }
        break;
      }
      case 'blink': {
        const target = near && Phaser.Math.Distance.Between(ox, oy, near.img.x, near.img.y) < move.range ? near : undefined;
        if (target) {
          sfx('dash');
          this.fxList.push({ kind: 'ring', x: ox, y: oy, r: 40, color: 0x4a3a5a, born: time, until: time + 240 });
          const nx = this.clampX(target.img.x - target.fx * 74, target.img.y - target.fy * 74, 40);
          this.playerImg.setPosition(nx, Phaser.Math.Clamp(target.img.y - target.fy * 74, 330, STAGE_LENGTH - 60));
          this.fxList.push({ kind: 'ring', x: this.playerImg.x, y: this.playerImg.y, r: 40, color: 0x4a3a5a, born: time, until: time + 240 });
          this.applyHit(target, move, 1);
          this.selfStunUntil = time + (move.selfStunS ?? 0.5) * 1000;
        }
        break;
      }
      case 'fanOrbs':
      case 'pellets': {
        sfx(move.behavior === 'pellets' ? 'burst' : 'zap');
        const n = move.orbCount ?? 3;
        const spreadTotal = move.behavior === 'pellets' ? 1 : 0.7;
        for (let i = 0; i < n; i++) {
          const a = ang + (i - (n - 1) / 2) * (spreadTotal / Math.max(1, n - 1)) * 2;
          this.spawnPBullet(move, Math.cos(a), Math.sin(a), 0);
        }
        break;
      }
      case 'homingStar': {
        sfx('discover');
        this.spawnPBullet(move, dx, dy, move.homing ?? 2.2);
        break;
      }
      case 'trackingRoar': {
        sfx('holler');
        this.spawnPBullet(move, dx, dy, move.homing ?? 4.5);
        break;
      }
      case 'curseOrb': {
        sfx('tether');
        this.spawnPBullet(move, dx, dy, move.homing ?? 0.8);
        break;
      }
      case 'cloudSelf': {
        sfx('wave');
        this.patches.push({ x: ox, y: oy, until: time + (move.cloudS ?? 4) * 1000, nextTick: 0, move, poison: true });
        break;
      }
      case 'veil': {
        sfx('wave');
        this.fxList.push({ kind: 'ring', x: ox, y: oy, r: move.range, color: 0xbfe4ff, born: time, until: time + 400 });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Phaser.Math.Distance.Between(ox, oy, e.img.x, e.img.y) < move.range + 30) {
            e.slowUntil = time + (move.slowS ?? 3) * 1000;
            this.popup(e.img.x, e.img.y - 40, 'SLOWED', '#bfe4ff');
          }
        }
        this.hasteUntil = time + (move.hasteS ?? 3) * 1000;
        this.popup(ox, oy - 56, 'HASTE!', '#bfe4ff');
        break;
      }
      case 'phase360': {
        sfx('tether');
        this.fxList.push({ kind: 'ring', x: ox, y: oy, r: move.range, color: 0x9ad0b0, born: time, until: time + 240 });
        const target = this.nearestEnemy(move.range + 34);
        if (target) this.applyHit(target, move, 1);
        break;
      }
      case 'channelBeam':
        break; // handled by pressMove/releaseChannel
    }
  }

  private spawnPBullet(move: MoveDef, nx: number, ny: number, homing: number): void {
    const speed = move.projSpeed ?? 300;
    const colors: Record<string, number> = {
      Psychic: 0xd08ad0,
      Metal: 0xb8b8b8,
      Mystical: 0xf0d060,
      Fighting: 0xe8a060,
      Ghost: 0x9ad0b0
    };
    this.pBullets.push({
      x: this.playerImg.x,
      y: this.playerImg.y,
      vx: nx * speed,
      vy: ny * speed,
      move,
      scale: 1,
      homing,
      range: move.range,
      traveled: 0,
      color: colors[move.type] ?? 0xf0e2c2,
      gone: false
    });
  }

  private nearestEnemyToExcept(x: number, y: number, maxDist: number, except: Enemy): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (e.dead || e === except) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.img.x, e.img.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private coneTargets(ox: number, oy: number, dx: number, dy: number, range: number, halfAngle: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.img.x - ox;
      const ey = e.img.y - oy;
      const d = Math.hypot(ex, ey);
      if (d > range + 34) continue;
      const angDiff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(ey, ex) - Math.atan2(dy, dx)));
      if (angDiff <= halfAngle) out.push(e);
    }
    out.sort(
      (a, b) =>
        Phaser.Math.Distance.Between(ox, oy, a.img.x, a.img.y) - Phaser.Math.Distance.Between(ox, oy, b.img.x, b.img.y)
    );
    return out;
  }

  /** Chance/duration status payloads carried by melee-family moves. */
  private applyOnHitEffects(e: Enemy, move: MoveDef, time: number): void {
    const pass = move.chance === undefined || Math.random() < move.chance;
    if (move.burnS) {
      e.burnUntil = time + move.burnS * 1000;
      e.burnNext = time + 400;
    }
    if (move.poisonS) {
      e.poisonUntil = time + move.poisonS * 1000;
      e.poisonNext = time + 500;
      this.popup(e.img.x, e.img.y - 44, 'POISONED', '#8a5aa0');
    }
    if (move.stunS && pass) {
      e.stunUntil = time + move.stunS * 1000;
      this.popup(e.img.x, e.img.y - 44, move.type === 'Frost' ? 'FROZEN' : 'STUNNED', '#bfe4ff');
    }
    if (move.scrambleS && pass) {
      e.scrambleUntil = time + move.scrambleS * 1000;
      this.popup(e.img.x, e.img.y - 44, 'SCRAMBLED', '#d08ad0');
    }
    if (move.charmS && pass) {
      e.charmUntil = time + move.charmS * 1000;
      this.popup(e.img.x, e.img.y - 44, 'CHARMED', '#d98aa8');
    }
    if (move.shieldS) {
      this.shieldUntil = time + move.shieldS * 1000;
      this.popup(this.playerImg.x, this.playerImg.y - 56, 'SHIELDED', '#b8b8b8');
    }
  }

  private applyHit(e: Enemy, move: MoveDef, powerScale: number, quiet = false): void {
    if (e.dead) return;
    const time = this.time.now;
    const f = this.team[this.activeIdx];
    if (move.power <= 0) return;
    let mult = 1;
    for (const t of e.types) mult *= effectiveness(move.type, t);
    if (move.type === 'Lightning' && e.soakUntil > time) mult *= 1.5;
    const atk = move.kind === 'physical' ? f.stats.atk : f.stats.spa;
    const def = move.kind === 'physical' ? e.stats.def : e.stats.spd;
    const dmg = damageRoll(f.inst.level, move.power * powerScale, atk, def, mult);
    e.hp -= dmg;
    if (!quiet) sfx('hit');
    const color = mult > 1 ? '#e8d24a' : mult < 1 ? '#9aa4ac' : '#f0e2c2';
    this.popup(e.img.x, e.img.y - 34, `${dmg}`, color);
    e.img.setTintFill(0xffffff);
    this.time.delayedCall(70, () => {
      if (!e.dead) {
        if (e.rare) e.img.setTint(0xffe9a0);
        else e.img.clearTint();
      }
    });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    e.alert.setVisible(false);
    sfx('faint');
    this.tweens.add({ targets: e.img, scaleX: 0, scaleY: 0, alpha: 0, duration: 260, onComplete: () => e.img.setVisible(false) });

    const gold = e.boss ? 25 : 2;
    gameState.data.currency += gold;
    this.goldEarned += gold;
    this.goldText.setText(`+${this.goldEarned}`);
    sfx('coin');

    const xp = xpFromKill(e.level, e.boss);
    this.team.forEach((m, i) => {
      if (m.hp <= 0 && i !== this.activeIdx) return;
      const gained = applyXp(m.inst, i === this.activeIdx ? xp : Math.floor(xp / 2));
      if (gained > 0 && i === this.activeIdx) {
        m.stats = battleStats(m.sp, m.inst.pedigree, m.inst.level);
        m.hp = Math.min(m.stats.hp, m.hp + Math.round(m.stats.hp * 0.3));
        this.popup(this.playerImg.x, this.playerImg.y - 60, `LV ${m.inst.level}!`, '#e8d24a');
        sfx('levelup');
      }
    });
    gameState.save();
    this.refreshHud();

    const guaranteed = e.rare || e.boss;
    if (guaranteed || Math.random() < CAPTURE_CHANCE) {
      this.time.delayedCall(500, () => {
        if (this.over) return;
        if (e.boss) this.pendingClear = true;
        stopMusic();
        this.scene.run('Capture', { speciesId: e.sp.id, fromStage: true, themeId: this.theme.id, boss: e.boss });
        this.scene.bringToTop('Capture');
        this.scene.sleep();
      });
      return;
    }
    if (e.boss) this.time.delayedCall(600, () => this.stageClear());
  }

  // ---------- player damage / faint ----------

  private hurtPlayer(dmg: number): void {
    if (this.over) return;
    const time = this.time.now;
    if (this.channel) this.releaseChannel(time); // interrupt fires the weak version
    const f = this.team[this.activeIdx];
    const final = time < this.shieldUntil ? Math.max(1, Math.round(dmg * 0.5)) : dmg;
    f.hp -= final;
    sfx('hurt');
    this.popup(this.playerImg.x, this.playerImg.y - 46, `${final}`, '#c75b4a');
    this.playerImg.setTintFill(0xe05c4a);
    this.time.delayedCall(90, () => this.playerImg.clearTint());
    this.cameras.main.shake(90, 0.004);
    if (f.hp <= 0) this.faintActive();
    else this.refreshHud();
  }

  private faintActive(): void {
    const f = this.team[this.activeIdx];
    f.hp = 0;
    sfx('faint');
    const next = this.team.findIndex((m) => m.hp > 0);
    if (next === -1) {
      this.stageFail();
      return;
    }
    this.activeIdx = next;
    sfx('swap');
    const n = this.team[next];
    const texKey = this.textures.exists(n.sp.textureKey) ? n.sp.textureKey : 'pl-unknown';
    this.playerImg.setTexture(texKey).setDisplaySize(100, 100);
    this.cooldownAt = [0, 0];
    this.pendingBeam = undefined;
    this.channel = undefined;
    this.buildMoveButtons();
    this.refreshHud();
    this.popup(this.playerImg.x, this.playerImg.y - 60, `${n.sp.name.toUpperCase()} STEPS IN!`, '#f0e2c2');
    gameState.save();
  }

  // ---------- reveals / toasts ----------

  private checkReveals(): void {
    const py = this.playerImg.y;
    this.def.groups.forEach((grp, gi) => {
      if (this.groupRevealed[gi] || py - grp.y > 1000) return;
      this.groupRevealed[gi] = true;
      const ids = new Set<string>();
      for (const e of this.enemies) if (e.group === gi) ids.add(e.sp.id);
      for (const id of ids) this.noteSeen(id);
    });
    if (!this.bossRevealed && py < 430 + 1000) {
      this.bossRevealed = true;
      this.noteSeen(this.def.bossId);
      playMusic('showdown');
      sfx('boss');
    }
  }

  private noteSeen(spId: string): void {
    if (this.seenThisStage.has(spId)) return;
    this.seenThisStage.add(spId);
    const isNew = (gameState.data.seen[spId] ?? 0) === 0;
    gameState.data.seen[spId] = (gameState.data.seen[spId] ?? 0) + 1;
    gameState.save();
    this.toastQueue.push({ sp: speciesById(spId), isNew });
    this.runToasts();
  }

  private runToasts(): void {
    if (this.toastBusy) return;
    const next = this.toastQueue.shift();
    if (!next) return;
    this.toastBusy = true;
    const { sp, isNew } = next;
    if (isNew) sfx('discover');
    const cont = this.add.container(-330, 170);
    const g = this.add.graphics();
    drawPixelPanel(g, 0, 0, 316, 92, COLORS.parchmentLight, COLORS.saddle, 4);
    cont.add(g);
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    cont.add(this.add.image(46, 46, texKey).setDisplaySize(64, 64));
    cont.add(this.add.text(88, 12, sp.name.toUpperCase(), { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink }));
    const types = [sp.type1, sp.type2].filter((t): t is string => !!t);
    types.forEach((t, i) => {
      const key = `type-${badgeName(t)}`;
      if (this.textures.exists(key)) cont.add(this.add.image(122 + i * 76, 56, key).setScale(1.5));
    });
    if (isNew) {
      cont.add(this.add.text(238, 12, 'NEW!', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.wantedRed }));
    }
    this.tweens.add({
      targets: cont,
      x: 14,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: cont,
            x: -330,
            duration: 220,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              cont.destroy();
              this.toastBusy = false;
              this.runToasts();
            }
          });
        });
      }
    });
  }

  // ---------- rendering ----------

  private drawShadows(): void {
    this.shadowG.clear();
    this.shadowG.fillStyle(COLORS.ink, 0.16);
    const p = this.playerImg;
    this.shadowG.fillRect(p.x - 30, p.y + 34, 60, 8);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const w = e.img.displayWidth * 0.7;
      this.shadowG.fillRect(e.img.x - w / 2, e.img.y + e.img.displayHeight / 2 - 8, w, 8);
    }
  }

  private drawFx(time: number): void {
    this.fxList = this.fxList.filter((fx) => fx.until > time);
    for (const fx of this.fxList) {
      const life = (fx.until - time) / Math.max(1, fx.until - fx.born);
      const alpha = 0.25 + 0.55 * life;
      if (fx.kind === 'line' && fx.x2 !== undefined && fx.y2 !== undefined) {
        this.fxG.lineStyle(fx.width ?? 6, fx.color, alpha);
        this.fxG.lineBetween(fx.x, fx.y, fx.x2, fx.y2);
      } else if (fx.kind === 'circle') {
        this.fxG.fillStyle(fx.color, alpha * 0.6);
        this.fxG.fillCircle(fx.x, fx.y, fx.r ?? 60);
      } else if (fx.kind === 'ring') {
        this.fxG.lineStyle(5, fx.color, alpha);
        this.fxG.strokeCircle(fx.x, fx.y, (fx.r ?? 60) * (1.2 - life * 0.4));
      } else if (fx.kind === 'cone' && fx.dir !== undefined && fx.spread !== undefined) {
        this.fxG.fillStyle(fx.color, alpha * 0.4);
        this.fxG.slice(fx.x, fx.y, fx.r ?? 100, fx.dir - fx.spread, fx.dir + fx.spread, false);
        this.fxG.fillPath();
      }
    }
    for (const p of this.patches) {
      const base = p.poison ? 0x8a5aa0 : 0xc7683a;
      const core = p.poison ? 0xa878b8 : 0xe8944a;
      this.fxG.fillStyle(base, 0.32);
      this.fxG.fillCircle(p.x, p.y, 100);
      this.fxG.fillStyle(core, 0.3);
      this.fxG.fillCircle(p.x, p.y, 62);
    }
    for (const w of this.waves) {
      this.fxG.fillStyle(0x7fa8c4, 0.6);
      this.fxG.fillRect(w.x - 170, w.y - 20, 340, 40);
    }
    for (const b of this.bullets) {
      this.fxG.fillStyle(COLORS.ink, 0.9);
      this.fxG.fillRect(b.x - 6, b.y - 6, 12, 12);
      this.fxG.fillStyle(0xe8d24a, 0.9);
      this.fxG.fillRect(b.x - 3, b.y - 3, 6, 6);
    }
    for (const b of this.pBullets) {
      this.fxG.fillStyle(COLORS.ink, 0.9);
      this.fxG.fillRect(b.x - 6, b.y - 6, 12, 12);
      this.fxG.fillStyle(b.color, 1);
      this.fxG.fillRect(b.x - 4, b.y - 4, 8, 8);
    }
    for (const w of this.weeds) {
      const wob = Math.floor(w.spin) % 2 === 0;
      this.fxG.fillStyle(COLORS.ink, 0.8);
      this.fxG.fillRect(w.x - 14, w.y - 14, 28, 28);
      this.fxG.fillStyle(0xa8834a, 1);
      this.fxG.fillRect(w.x - 12, w.y - 12, 24, 24);
      this.fxG.fillStyle(0x7a5a2e, 1);
      if (wob) {
        this.fxG.fillRect(w.x - 12, w.y - 2, 24, 4);
        this.fxG.fillRect(w.x - 2, w.y - 12, 4, 24);
      } else {
        this.fxG.fillRect(w.x - 10, w.y - 10, 6, 6);
        this.fxG.fillRect(w.x + 4, w.y + 4, 6, 6);
        this.fxG.fillRect(w.x + 4, w.y - 10, 6, 6);
        this.fxG.fillRect(w.x - 10, w.y + 4, 6, 6);
      }
    }
    for (const d of this.drops) {
      const frac = 1 - Math.max(0, d.impactAt - time) / 850;
      this.fxG.lineStyle(3, COLORS.ink, 0.5);
      this.fxG.strokeCircle(d.x, d.y, 80);
      this.fxG.fillStyle(COLORS.ink, 0.25);
      this.fxG.fillCircle(d.x, d.y, 80 * frac);
    }
  }

  private drawEnemyBars(time: number): void {
    this.barG.clear();
    const viewTop = -this.world.y - 60;
    const viewBottom = -this.world.y + this.scale.height + 60;
    for (const e of this.enemies) {
      if (e.dead || e.img.y < viewTop || e.img.y > viewBottom) continue;
      const w = e.boss ? 110 : 56;
      const x = e.img.x - w / 2;
      const y = e.img.y - e.img.displayHeight / 2 - 14;
      this.barG.fillStyle(COLORS.ink, 0.8);
      this.barG.fillRect(x - 1, y - 1, w + 2, 8);
      this.barG.fillStyle(COLORS.adobeRed);
      this.barG.fillRect(x, y, Math.max(1, Math.round(w * (e.hp / e.maxHp))), 6);
      // status marks
      const marks: number[] = [];
      if (e.burnUntil > time) marks.push(0xc7683a);
      if (e.poisonUntil > time) marks.push(0x8a5aa0);
      if (e.soakUntil > time) marks.push(0x7fa8c4);
      if (e.rootUntil > time) marks.push(0x7c8b6f);
      if (e.stunUntil > time) marks.push(0xbfe4ff);
      if (e.slowUntil > time) marks.push(0x6f9cba);
      if (e.charmUntil > time) marks.push(0xd98aa8);
      if (e.scrambleUntil > time) marks.push(0xd08ad0);
      if (e.atkDownUntil > time) marks.push(0x9aa4ac);
      if (e.accDownUntil > time) marks.push(0xc9b98a);
      if (e.curseAt > 0) marks.push(0x4a3a5a);
      marks.slice(0, 6).forEach((c, i) => {
        this.barG.fillStyle(c);
        this.barG.fillRect(x + i * 11, y - 6, 9, 4);
      });
    }
  }

  private updateCooldownOverlays(time: number): void {
    this.moveBtns.forEach((b, i) => {
      b.cdG.clear();
      if (this.channel && this.channel.idx === i) {
        const frac = Phaser.Math.Clamp((time - this.channel.start) / ((b.move.channelMaxS ?? 1.2) * 1000), 0, 1);
        b.cdG.fillStyle(0xc75b4a, 0.4);
        b.cdG.fillRect(b.face.x - 115, b.face.y + 60 - Math.round(120 * frac), 230, Math.round(120 * frac));
        return;
      }
      const remaining = this.cooldownAt[i] - time;
      if (remaining > 0) {
        const frac = Phaser.Math.Clamp(remaining / cooldownMs(b.move), 0, 1);
        const h = Math.round(120 * frac);
        b.cdG.fillStyle(COLORS.ink, 0.55);
        b.cdG.fillRect(b.face.x - 115, b.face.y + 60 - h, 230, h);
      }
    });
  }

  private popup(x: number, y: number, msg: string, color: string): void {
    const t = this.add.text(x, y, msg, { fontFamily: FONT.ui, fontSize: '18px', color }).setOrigin(0.5);
    this.topLayer.add(t);
    this.tweens.add({ targets: t, y: y - 44, alpha: 0, duration: 750, onComplete: () => t.destroy() });
  }

  // ---------- stage end ----------

  private stageClear(): void {
    if (this.over) return;
    this.over = true;
    this.pendingClear = false;
    stopMusic();
    sfx('clear');
    const pin = gameState.data.pins.find((p) => p.seed === this.def.seed);
    if (pin) pin.completed = true;
    gameState.data.currency += 40;
    this.goldEarned += 40;
    // bounty board daily-challenge tallies
    gameState.bumpQuest('stages');
    gameState.bumpQuest('flats'); // this map IS Frontier Flats
    if (this.team.length === 3 && this.team.every((m) => m.hp > 0)) gameState.bumpQuest('fullPosse');
    if (this.team.every((m) => m.sp.type1 === 'Grass' || m.sp.type2 === 'Grass')) gameState.bumpQuest('grassClear');
    gameState.save();
    this.endOverlay('TRAIL CLEARED!', `+${this.goldEarned} GOLD EARNED`, HEX.brass);
  }

  private stageFail(): void {
    if (this.over) return;
    this.over = true;
    stopMusic();
    sfx('fail');
    gameState.save();
    this.endOverlay('THE POSSE GOT ROUGHED UP', 'XP AND GOLD KEPT - REST UP AND TRY AGAIN', HEX.sage);
  }

  private quit(): void {
    if (this.over) return;
    this.over = true;
    stopMusic();
    gameState.save();
    this.scene.start('Map');
  }

  private endOverlay(title: string, sub: string, subColor: string): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
    this.add
      .text(width / 2, height * 0.4, title, { fontFamily: FONT.display, fontSize: '44px', color: HEX.parchment })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.4 + 64, sub, { fontFamily: FONT.ui, fontSize: '20px', color: subColor })
      .setOrigin(0.5);
    makeButton(this, width / 2, height * 0.6, 320, 70, 'BACK TO MAP', () => this.scene.start('Map'), '20px');
  }
}
