import Phaser from 'phaser';
import { SpeciesDef, speciesById } from '../data/species';
import { generateStage, StageDef, StageTheme, STAGE_THEMES, STAGE_LENGTH } from '../data/stages';
import { CritterInstance, gameState } from '../state/GameState';
import { badgeName, effectiveness } from '../data/typeChart';
import { BattleStats, battleStats, wildStats, damageRoll, xpFromKill, applyXp } from '../battle/stats';
import { MoveDef, movesForSpecies } from '../battle/moves';
import { playMusic, stopMusic, sfx } from '../audio/audio';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { seededRng } from '../util/daily';

const WORLD_W = 720;
const ARENA_L = 44;
const ARENA_R = WORLD_W - 44;
const ENGAGE_RANGE = 470;
const DASH_LEN = 230;
const DASH_MS = 170;
const DASH_CD = 600;
const CAPTURE_CHANCE = 0.2;

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
  burnUntil: number;
  burnNext: number;
  rootUntil: number;
  soakUntil: number;
  atkDownUntil: number;
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
  gone: boolean;
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
  color: number;
  born: number;
  until: number;
}

/**
 * A generated stage - the Rumble-style core loop. The active critter
 * auto-runs up the trail, stops to fight each spawn group, boss at the
 * end. 1-2 move buttons with cooldowns; swipe to dash-reposition.
 * Defeats grant XP (full to the active critter, half to reserves) and can
 * trigger the lasso capture mini-game (1-in-5; rares + boss always).
 */
export class StageScene extends Phaser.Scene {
  private def!: StageDef;
  private theme!: StageTheme;
  private team: Fighter[] = [];
  private activeIdx = 0;
  private playerImg!: Phaser.GameObjects.Image;
  private enemies: Enemy[] = [];
  private lobs: Lob[] = [];
  private patches: Patch[] = [];
  private waves: Wave[] = [];
  private bullets: Bullet[] = [];
  private fxList: Fx[] = [];
  private cooldownAt: number[] = [0, 0];
  private pendingBeam?: { fireAt: number; dir: { x: number; y: number }; move: MoveDef };
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
  private fxG!: Phaser.GameObjects.Graphics;
  private barG!: Phaser.GameObjects.Graphics;
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
    this.team = [];
    this.activeIdx = 0;
    this.enemies = [];
    this.lobs = [];
    this.patches = [];
    this.waves = [];
    this.bullets = [];
    this.fxList = [];
    this.cooldownAt = [0, 0];
    this.pendingBeam = undefined;
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
    const { height } = this.scale;
    this.cameras.main.setBackgroundColor(this.theme.ground);
    this.cameras.main.setBounds(0, 0, WORLD_W, STAGE_LENGTH);

    this.buildTeam();
    if (this.team.length === 0) {
      // no critters to ride with - MapScene guards this, but never crash
      this.scene.start('Map');
      return;
    }
    this.drawBackground();
    this.spawnAll();

    const active = this.team[this.activeIdx];
    const texKey = this.textures.exists(active.sp.textureKey) ? active.sp.textureKey : 'pl-unknown';
    this.playerImg = this.add.image(WORLD_W / 2, STAGE_LENGTH - 240, texKey).setDisplaySize(84, 84).setDepth(10);

    this.fxG = this.add.graphics().setDepth(12);
    this.barG = this.add.graphics().setDepth(11);

    this.buildHud();
    this.buildMoveButtons();
    this.bindInput();

    playMusic('trail');
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      playMusic(this.bossRevealed ? 'showdown' : 'trail');
      if (this.pendingClear) this.stageClear();
    });

    this.cameras.main.scrollY = Phaser.Math.Clamp(this.playerImg.y - height * 0.62, 0, STAGE_LENGTH - height);
  }

  // ---------- setup ----------

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

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(0);
    const rng = seededRng(`${this.def.seed}-bg`);
    g.fillStyle(this.theme.ground);
    g.fillRect(0, 0, WORLD_W, STAGE_LENGTH);
    // meandering trail
    g.fillStyle(this.theme.trail, 0.55);
    let tx = WORLD_W / 2;
    for (let y = 0; y < STAGE_LENGTH; y += 90) {
      tx = Phaser.Math.Clamp(tx + Math.floor(rng() * 90 - 45), 220, 500);
      g.fillRect(tx - 95, y, 190, 96);
    }
    // ground speckle + props
    g.fillStyle(this.theme.groundDark);
    for (let i = 0; i < 260; i++) {
      g.fillRect(Math.floor(rng() * WORLD_W), Math.floor(rng() * STAGE_LENGTH), 4, 4);
    }
    for (let y = 140; y < STAGE_LENGTH - 140; y += 170) {
      const side = rng() < 0.5 ? 70 + rng() * 90 : WORLD_W - 160 + rng() * 90;
      this.drawProp(g, side, y + rng() * 80, rng);
    }
    // arena rails
    g.fillStyle(COLORS.saddleDark, 0.5);
    g.fillRect(ARENA_L - 14, 0, 6, STAGE_LENGTH);
    g.fillRect(ARENA_R + 8, 0, 6, STAGE_LENGTH);
  }

  private drawProp(g: Phaser.GameObjects.Graphics, x: number, y: number, rng: () => number): void {
    switch (this.theme.prop) {
      case 'grass':
        g.fillStyle(0x8a9a4a);
        g.fillRect(x, y, 6, 18);
        g.fillRect(x + 8, y + 4, 6, 14);
        g.fillRect(x - 8, y + 6, 6, 12);
        break;
      case 'flower': {
        const colors = [0xc75b4a, 0xd9b13b, 0x7a6bb5, 0xd9d9d9];
        g.fillStyle(colors[Math.floor(rng() * colors.length)]);
        g.fillRect(x, y, 10, 10);
        g.fillStyle(0x8a9a4a);
        g.fillRect(x + 3, y + 10, 4, 12);
        break;
      }
      case 'reed':
        g.fillStyle(0x5f8aa8, 0.8);
        g.fillEllipse(x, y + 18, 90, 34);
        g.fillStyle(0x4a7a52);
        g.fillRect(x - 30, y - 6, 5, 26);
        g.fillRect(x - 20, y - 12, 5, 32);
        break;
      case 'tree':
        g.fillStyle(0x5a4630);
        g.fillRect(x - 6, y + 10, 12, 22);
        g.fillStyle(0x4f7038);
        g.fillRect(x - 26, y - 26, 52, 44);
        g.fillStyle(0x5d8242);
        g.fillRect(x - 18, y - 34, 36, 24);
        break;
      case 'rock':
        g.fillStyle(0x8d8a80);
        g.fillRect(x - 14, y, 30, 22);
        g.fillStyle(0xa5a298);
        g.fillRect(x - 8, y - 8, 20, 12);
        break;
      case 'fence':
        g.fillStyle(0x6b4a2b);
        g.fillRect(x - 40, y + 8, 84, 5);
        g.fillRect(x - 40, y, 6, 22);
        g.fillRect(x, y, 6, 22);
        g.fillRect(x + 38, y, 6, 22);
        break;
    }
  }

  private spawnAll(): void {
    const rng = seededRng(`${this.def.seed}-spawn`);
    const offsets = [
      [0, 0],
      [-130, 60],
      [130, 60],
      [-70, -90],
      [70, -90]
    ];
    this.def.groups.forEach((grp, gi) => {
      const cx = 220 + Math.floor(rng() * 280);
      const total = grp.count + (grp.rareId ? 1 : 0);
      for (let i = 0; i < total; i++) {
        const isRare = !!grp.rareId && i === 0;
        const spId = isRare ? (grp.rareId as string) : grp.speciesId;
        const [ox, oy] = offsets[i % offsets.length];
        this.spawnEnemy(spId, cx + ox, grp.y + oy, grp.level, gi, false, isRare);
      }
    });
    this.spawnEnemy(this.def.bossId, WORLD_W / 2, 420, this.def.bossLevel, this.def.groups.length, true, false);
  }

  private spawnEnemy(spId: string, x: number, y: number, level: number, group: number, boss: boolean, rare: boolean): void {
    const sp = speciesById(spId);
    const stats = wildStats(sp, level);
    const maxHp = Math.round(stats.hp * (boss ? 3.2 : 1));
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const size = boss ? 150 : rare ? 92 : 76;
    const px = Phaser.Math.Clamp(x, ARENA_L + 50, ARENA_R - 50);
    const img = this.add.image(px, y, texKey).setDisplaySize(size, size).setDepth(8);
    if (rare) img.setTint(0xffe9a0);
    const alert = this.add
      .text(px, y - size / 2 - 22, '!', { fontFamily: FONT.ui, fontSize: '32px', color: HEX.wantedRed })
      .setOrigin(0.5)
      .setDepth(13)
      .setVisible(false);
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
      burnUntil: 0,
      burnNext: 0,
      rootUntil: 0,
      soakUntil: 0,
      atkDownUntil: 0,
      kbx: 0,
      kby: 0,
      dead: false
    });
  }

  // ---------- HUD ----------

  private buildHud(): void {
    const { width } = this.scale;
    const g = this.add.graphics().setScrollFactor(0).setDepth(50);
    drawPixelPanel(g, 12, 12, 320, 96, COLORS.parchmentLight, COLORS.saddle, 4);
    this.hudFace = this.add.image(52, 60, 'pl-unknown').setDisplaySize(60, 60).setScrollFactor(0).setDepth(51);
    this.hudName = this.add
      .text(92, 26, '', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink })
      .setScrollFactor(0)
      .setDepth(51);
    this.hudLv = this.add
      .text(322, 26, '', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(51);
    this.hudHpG = this.add.graphics().setScrollFactor(0).setDepth(51);
    for (let i = 0; i < 2; i++) {
      const face = this.add
        .image(360 + i * 56, 44, 'pl-unknown')
        .setDisplaySize(44, 44)
        .setScrollFactor(0)
        .setDepth(51)
        .setVisible(false);
      this.reserveFaces.push(face);
    }
    this.add.image(width - 210, 36, 'icon-coin').setTint(COLORS.brass).setScale(0.7).setScrollFactor(0).setDepth(51);
    this.goldText = this.add
      .text(width - 188, 36, '+0', { fontFamily: FONT.ui, fontSize: '20px', color: HEX.brass })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(51);
    makeButton(this, width - 76, 40, 110, 48, 'FLEE', () => this.quit(), '18px')
      .setScrollFactor(0)
      .setDepth(51);
    // progress pips: one per group + a wider one for the boss
    const total = this.def.groups.length + 1;
    for (let i = 0; i < total; i++) {
      const pip = this.add
        .rectangle(width / 2 - (total * 26) / 2 + i * 26 + 8, 126, i === total - 1 ? 20 : 14, 14, COLORS.parchmentDark)
        .setStrokeStyle(2, COLORS.saddle)
        .setScrollFactor(0)
        .setDepth(51);
      this.pips.push(pip);
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
    this.hudHpG.fillStyle(COLORS.ink, 0.6);
    this.hudHpG.fillRect(90, 78, 216, 2);
    // reserves
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
      const cleared = this.enemies.filter((e) => e.group === gi).every((e) => e.dead);
      if (cleared) this.pips[gi].setFillStyle(COLORS.sage);
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
      const shadow = this.add.rectangle(bx, by + 5, 230, 120, COLORS.ink).setScrollFactor(0).setDepth(52);
      const face = this.add
        .rectangle(bx, by, 230, 120, COLORS.saddle)
        .setStrokeStyle(2, COLORS.ink)
        .setScrollFactor(0)
        .setDepth(52);
      const badgeKey = `type-${move.type}`;
      if (this.textures.exists(badgeKey)) {
        parts.push(this.add.image(bx, by - 32, badgeKey).setScale(2).setScrollFactor(0).setDepth(53));
      }
      const label = this.add
        .text(bx, by + 18, move.name, {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.parchment,
          align: 'center',
          wordWrap: { width: 210 }
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(53);
      const cdG = this.add.graphics().setScrollFactor(0).setDepth(54);
      face.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.useMove(i));
      parts.push(shadow, face, label, cdG);
      this.moveBtns.push({ move, face, cdG, parts });
    });
  }

  private bindInput(): void {
    const { height } = this.scale;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > height - 170) return; // button row
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart || this.over) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = undefined;
      const len = Math.hypot(dx, dy);
      if (len < 48 || this.time.now < this.dashCdAt) return;
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
    const { height } = this.scale;
    this.fxG.clear();

    this.updatePlayer(time, dt);
    this.updateEnemies(time, dt);
    this.updateProjectiles(time, dt);
    this.updateBeam(time);
    this.drawFx(time);
    this.drawEnemyBars();
    this.updateCooldownOverlays(time);
    this.checkReveals();

    this.cameras.main.scrollY = Phaser.Math.Clamp(this.playerImg.y - height * 0.62, 0, STAGE_LENGTH - height);
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
    } else {
      this.dashMove = undefined;
      const near = this.nearestEnemy(ENGAGE_RANGE);
      const speed = Phaser.Math.Clamp(130 + f.stats.spe * 0.6, 130, 260);
      if (near) {
        const d = Phaser.Math.Distance.Between(img.x, img.y, near.img.x, near.img.y);
        if (d > 150) {
          img.x += ((near.img.x - img.x) / d) * speed * 0.8 * dt;
          img.y += ((near.img.y - img.y) / d) * speed * 0.8 * dt;
        }
      } else {
        img.y -= speed * dt;
        img.x += (WORLD_W / 2 - img.x) * 0.5 * dt;
      }
    }
    // never pass an uncleared group
    for (let gi = 0; gi < this.def.groups.length; gi++) {
      const alive = this.enemies.some((e) => e.group === gi && !e.dead);
      if (alive) {
        img.y = Math.max(img.y, this.def.groups[gi].y - 80);
        break;
      }
    }
    img.x = Phaser.Math.Clamp(img.x, ARENA_L + 40, ARENA_R - 40);
    img.y = Phaser.Math.Clamp(img.y, 320, STAGE_LENGTH - 60);
  }

  private updateEnemies(time: number, dt: number): void {
    const px = this.playerImg.x;
    const py = this.playerImg.y;
    const f = this.team[this.activeIdx];
    for (const e of this.enemies) {
      if (e.dead) continue;
      // status: burn ticks
      if (e.burnUntil > time && time > e.burnNext) {
        e.burnNext = time + 500;
        e.hp -= Math.max(1, Math.round(e.maxHp * 0.02));
        this.popup(e.img.x, e.img.y - 30, 'BURN', '#c75b4a');
        if (e.hp <= 0) {
          this.killEnemy(e);
          continue;
        }
      }
      // knockback decay
      if (Math.abs(e.kbx) > 4 || Math.abs(e.kby) > 4) {
        e.img.x += e.kbx * dt;
        e.img.y += e.kby * dt;
        e.kbx *= 0.82;
        e.kby *= 0.82;
      }
      const rooted = e.rootUntil > time;
      const dist = Phaser.Math.Distance.Between(px, py, e.img.x, e.img.y);
      const telegraphing = e.telegraphUntil > time;
      e.alert.setPosition(e.img.x, e.img.y - e.img.displayHeight / 2 - 22).setVisible(telegraphing);

      if (e.lungeUntil > time) {
        e.img.x += e.lungeVx * dt;
        e.img.y += e.lungeVy * dt;
        if (!e.lungeHit && dist < 78) {
          e.lungeHit = true;
          this.hurtPlayer(damageRoll(e.level, 32, this.enemyAtk(e, time), f.stats.def, 1));
        }
      } else if (!rooted && !telegraphing) {
        if (dist < 420) {
          const spd = Phaser.Math.Clamp(e.sp.moveSpeed * 0.55, 44, e.boss ? 90 : 140);
          if (dist > 60) {
            e.img.x += ((px - e.img.x) / dist) * spd * dt;
            e.img.y += ((py - e.img.y) / dist) * spd * dt;
          }
        } else {
          if (time > e.wanderAt) {
            e.wanderAt = time + 1300 + Math.random() * 900;
            e.targetX = e.homeX + Math.random() * 140 - 70;
            e.targetY = e.homeY + Math.random() * 140 - 70;
          }
          const d = Phaser.Math.Distance.Between(e.img.x, e.img.y, e.targetX, e.targetY);
          if (d > 8) {
            e.img.x += ((e.targetX - e.img.x) / d) * 34 * dt;
            e.img.y += ((e.targetY - e.img.y) / d) * 34 * dt;
          }
        }
      }
      e.img.x = Phaser.Math.Clamp(e.img.x, ARENA_L + 30, ARENA_R - 30);

      // contact damage
      if (dist < (e.boss ? 95 : 62) && time > e.nextContact) {
        e.nextContact = time + 900;
        const mult = e.atkDownUntil > time ? 0.6 : 1;
        this.hurtPlayer(damageRoll(e.level, 20, e.stats.atk * mult, f.stats.def, 1));
      }
      // telegraphed attack
      if (dist < 500 && time > e.nextAttack && !telegraphing && e.lungeUntil < time) {
        e.telegraphUntil = time + 550;
        e.nextAttack = time + (e.boss ? 2300 : 3400) + Math.random() * 1600;
      }
      if (!telegraphing && e.telegraphUntil > 0 && time >= e.telegraphUntil) {
        e.telegraphUntil = 0;
        this.enemyAttack(e, time);
      }
    }
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
    const special = (e.sp.atkStyle ?? 'physical') === 'special';
    if (e.boss) {
      // radial volley
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
          gone: false
        });
      }
      return;
    }
    if (special) {
      sfx('lob');
      this.bullets.push({
        x: e.img.x,
        y: e.img.y,
        vx: (dx / d) * 260,
        vy: (dy / d) * 260,
        level: e.level,
        atk: e.stats.spa,
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
    // enemy bullets
    for (const b of this.bullets) {
      if (b.gone) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < ARENA_L || b.x > ARENA_R || Math.abs(b.y - this.playerImg.y) > 900) {
        b.gone = true;
        continue;
      }
      if (Phaser.Math.Distance.Between(b.x, b.y, this.playerImg.x, this.playerImg.y) < 40) {
        b.gone = true;
        this.hurtPlayer(damageRoll(b.level, 30, b.atk, f.stats.spd, 1));
      }
    }
    this.bullets = this.bullets.filter((b) => !b.gone);

    // lobbed shots
    for (const lob of this.lobs) {
      lob.t += dt / 0.7;
      const t = Math.min(1, lob.t);
      lob.x = lob.fromX + (lob.toX - lob.fromX) * t;
      lob.y = lob.fromY + (lob.toY - lob.fromY) * t - Math.sin(Math.PI * t) * 130;
      lob.img.setPosition(lob.x, lob.y);
      if (t >= 1) {
        lob.img.destroy();
        if (lob.move.behavior === 'lobPatch') {
          this.patches.push({ x: lob.toX, y: lob.toY, until: time + (lob.move.patchS ?? 3) * 1000, nextTick: 0, move: lob.move });
          sfx('burst');
        } else {
          sfx('burst');
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

    // burning patches
    for (const p of this.patches) {
      if (time > p.nextTick) {
        p.nextTick = time + 500;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Phaser.Math.Distance.Between(p.x, p.y, e.img.x, e.img.y) < 100) {
            this.applyHit(e, p.move, 0.3, true);
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

  private updateBeam(time: number): void {
    const b = this.pendingBeam;
    if (!b || time < b.fireAt) return;
    this.pendingBeam = undefined;
    sfx('zap');
    const ox = this.playerImg.x;
    const oy = this.playerImg.y;
    this.fxList.push({
      kind: 'line',
      x: ox,
      y: oy,
      x2: ox + b.dir.x * 900,
      y2: oy + b.dir.y * 900,
      color: 0xe8d24a,
      born: time,
      until: time + 220
    });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const relX = e.img.x - ox;
      const relY = e.img.y - oy;
      const t = relX * b.dir.x + relY * b.dir.y;
      if (t < 0 || t > 900) continue;
      const perp = Math.abs(relX * b.dir.y - relY * b.dir.x);
      if (perp < 44) this.applyHit(e, b.move, 1);
    }
  }

  // ---------- moves ----------

  private useMove(i: number): void {
    if (this.over) return;
    const time = this.time.now;
    if (time < this.cooldownAt[i]) return;
    const f = this.team[this.activeIdx];
    const move = f.moves[i];
    if (!move) return;
    this.cooldownAt[i] = time + move.cooldownS * 1000;

    const near = this.nearestEnemy(700);
    let dx = 0;
    let dy = -1;
    if (near) {
      const d = Math.max(1, Phaser.Math.Distance.Between(this.playerImg.x, this.playerImg.y, near.img.x, near.img.y));
      dx = (near.img.x - this.playerImg.x) / d;
      dy = (near.img.y - this.playerImg.y) / d;
    }
    const ox = this.playerImg.x;
    const oy = this.playerImg.y;
    const dir = Math.atan2(dy, dx);

    switch (move.behavior) {
      case 'arc':
      case 'wideArc': {
        sfx(move.behavior === 'arc' ? 'whip' : 'punch');
        const spread = move.behavior === 'arc' ? 1.1 : 1.4;
        this.fxList.push({ kind: 'cone', x: ox, y: oy, dir, spread, r: move.range, color: 0xf0e2c2, born: time, until: time + 160 });
        for (const e of this.coneTargets(ox, oy, dx, dy, move.range, spread)) {
          this.applyHit(e, move, 1);
          if (move.burnS) {
            e.burnUntil = time + move.burnS * 1000;
            e.burnNext = time + 400;
          }
        }
        break;
      }
      case 'conePush':
      case 'coneKnock': {
        sfx('wave');
        const spread = move.behavior === 'conePush' ? 0.8 : 1.25;
        this.fxList.push({ kind: 'cone', x: ox, y: oy, dir, spread, r: move.range, color: 0x9fc4d8, born: time, until: time + 180 });
        for (const e of this.coneTargets(ox, oy, dx, dy, move.range, spread)) {
          this.applyHit(e, move, 1);
          e.kbx = dx * (move.knockback ?? 130) * 3.2;
          e.kby = dy * (move.knockback ?? 130) * 3.2;
        }
        break;
      }
      case 'tether': {
        sfx('tether');
        const targets = this.coneTargets(ox, oy, dx, dy, move.range, 0.3);
        const first = targets[0];
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
        const targets = this.coneTargets(ox, oy, dx, dy, move.range, 0.9);
        const first = targets[0];
        if (first) {
          this.applyHit(first, move, 1);
          let chain: Enemy | undefined;
          let bd = 180;
          for (const e of this.enemies) {
            if (e.dead || e === first) continue;
            const d = Phaser.Math.Distance.Between(first.img.x, first.img.y, e.img.x, e.img.y);
            if (d < bd) {
              bd = d;
              chain = e;
            }
          }
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
        this.fxList.push({ kind: 'line', x: ox, y: oy, x2: ox + dx * 900, y2: oy + dy * 900, color: 0xe8d24a, born: time, until: time + (move.telegraphS ?? 0.45) * 1000 });
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
        const img = this.add
          .rectangle(ox, oy, 16, 16, move.behavior === 'lobPatch' ? 0xc7683a : 0x6f9a4a)
          .setDepth(11);
        this.lobs.push({ x: ox, y: oy, fromX: ox, fromY: oy, toX: tx, toY: ty, t: 0, move, img });
        break;
      }
      case 'radialDebuff': {
        sfx('holler');
        this.fxList.push({ kind: 'ring', x: ox, y: oy, r: move.range, color: 0xf0e2c2, born: time, until: time + 300 });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Phaser.Math.Distance.Between(ox, oy, e.img.x, e.img.y) < move.range + 30) {
            this.applyHit(e, move, 1);
            e.atkDownUntil = time + (move.atkDownS ?? 4) * 1000;
          }
        }
        break;
      }
      case 'wave': {
        sfx('wave');
        this.waves.push({ x: ox, y: oy - 40, dirY: dy < 0 ? -1 : 1, until: time + 2400, move, hit: new Set() });
        break;
      }
    }
  }

  private coneTargets(ox: number, oy: number, dx: number, dy: number, range: number, halfAngle: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.img.x - ox;
      const ey = e.img.y - oy;
      const d = Math.hypot(ex, ey);
      if (d > range + 34) continue;
      const ang = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(ey, ex) - Math.atan2(dy, dx)));
      if (ang <= halfAngle) out.push(e);
    }
    out.sort(
      (a, b) =>
        Phaser.Math.Distance.Between(ox, oy, a.img.x, a.img.y) - Phaser.Math.Distance.Between(ox, oy, b.img.x, b.img.y)
    );
    return out;
  }

  private applyHit(e: Enemy, move: MoveDef, powerScale: number, quiet = false): void {
    const time = this.time.now;
    const f = this.team[this.activeIdx];
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

    // gold
    const gold = e.boss ? 25 : 2;
    gameState.data.currency += gold;
    this.goldEarned += gold;
    this.goldText.setText(`+${this.goldEarned}`);
    sfx('coin');

    // XP: full to the active critter, half to living reserves
    const xp = xpFromKill(e.level, e.boss);
    this.team.forEach((m, i) => {
      if (m.hp <= 0 && i !== this.activeIdx) return;
      const gained = applyXp(m.inst, i === this.activeIdx ? xp : Math.floor(xp / 2));
      if (gained > 0 && i === this.activeIdx) {
        // level up refreshes the active fighter's spread
        m.stats = battleStats(m.sp, m.inst.pedigree, m.inst.level);
        m.hp = Math.min(m.stats.hp, m.hp + Math.round(m.stats.hp * 0.3));
        this.popup(this.playerImg.x, this.playerImg.y - 60, `LV ${m.inst.level}!`, '#e8d24a');
        sfx('levelup');
      }
    });
    gameState.save();
    this.refreshHud();

    // capture opportunity: rares + boss always, otherwise 1-in-5
    const guaranteed = e.rare || e.boss;
    if (guaranteed || Math.random() < CAPTURE_CHANCE) {
      this.time.delayedCall(500, () => {
        if (this.over) return;
        if (e.boss) this.pendingClear = true;
        stopMusic();
        this.scene.run('Capture', { speciesId: e.sp.id, fromStage: true, themeId: this.theme.id });
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
    const f = this.team[this.activeIdx];
    f.hp -= dmg;
    sfx('hurt');
    this.popup(this.playerImg.x, this.playerImg.y - 46, `${dmg}`, '#c75b4a');
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
    this.playerImg.setTexture(texKey).setDisplaySize(84, 84);
    this.cooldownAt = [0, 0];
    this.pendingBeam = undefined;
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
    if (!this.bossRevealed && py < 420 + 1000) {
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
    const parts: Phaser.GameObjects.GameObject[] = [];
    const cont = this.add.container(-330, 170).setScrollFactor(0).setDepth(60);
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
      cont.add(
        this.add.text(238, 12, 'NEW!', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.wantedRed })
      );
    }
    parts.push(cont);
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
              parts.forEach((p) => p.destroy());
              this.toastBusy = false;
              this.runToasts();
            }
          });
        });
      }
    });
  }

  // ---------- rendering helpers ----------

  private drawFx(time: number): void {
    this.fxList = this.fxList.filter((fx) => fx.until > time);
    for (const fx of this.fxList) {
      const life = (fx.until - time) / Math.max(1, fx.until - fx.born);
      const alpha = 0.25 + 0.55 * life;
      if (fx.kind === 'line' && fx.x2 !== undefined && fx.y2 !== undefined) {
        this.fxG.lineStyle(6, fx.color, alpha);
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
    // patches + waves live-rendered
    for (const p of this.patches) {
      this.fxG.fillStyle(0xc7683a, 0.35);
      this.fxG.fillCircle(p.x, p.y, 100);
      this.fxG.fillStyle(0xe8944a, 0.3);
      this.fxG.fillCircle(p.x, p.y, 62);
    }
    for (const w of this.waves) {
      this.fxG.fillStyle(0x7fa8c4, 0.6);
      this.fxG.fillRect(w.x - 170, w.y - 20, 340, 40);
    }
    for (const b of this.bullets) {
      this.fxG.fillStyle(COLORS.ink, 0.9);
      this.fxG.fillCircle(b.x, b.y, 9);
      this.fxG.fillStyle(0xe8d24a, 0.9);
      this.fxG.fillCircle(b.x, b.y, 5);
    }
  }

  private drawEnemyBars(): void {
    this.barG.clear();
    const cam = this.cameras.main;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.img.y < cam.scrollY - 60 || e.img.y > cam.scrollY + this.scale.height + 60) continue;
      const w = e.boss ? 110 : 56;
      const x = e.img.x - w / 2;
      const y = e.img.y - e.img.displayHeight / 2 - 14;
      this.barG.fillStyle(COLORS.ink, 0.8);
      this.barG.fillRect(x - 1, y - 1, w + 2, 8);
      this.barG.fillStyle(COLORS.adobeRed);
      this.barG.fillRect(x, y, Math.max(1, Math.round(w * (e.hp / e.maxHp))), 6);
      if (e.soakUntil > this.time.now) {
        this.barG.fillStyle(0x7fa8c4);
        this.barG.fillRect(x, y - 5, 10, 3);
      }
      if (e.burnUntil > this.time.now) {
        this.barG.fillStyle(0xc7683a);
        this.barG.fillRect(x + 12, y - 5, 10, 3);
      }
    }
  }

  private updateCooldownOverlays(time: number): void {
    this.moveBtns.forEach((b, i) => {
      b.cdG.clear();
      const remaining = this.cooldownAt[i] - time;
      if (remaining > 0) {
        const frac = Phaser.Math.Clamp(remaining / (b.move.cooldownS * 1000), 0, 1);
        const h = Math.round(120 * frac);
        b.cdG.fillStyle(COLORS.ink, 0.55);
        b.cdG.fillRect(b.face.x - 115, b.face.y + 60 - h, 230, h);
      }
    });
  }

  private popup(x: number, y: number, msg: string, color: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: FONT.ui, fontSize: '18px', color })
      .setOrigin(0.5)
      .setDepth(30);
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
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setScrollFactor(0).setDepth(80);
    this.add
      .text(width / 2, height * 0.4, title, { fontFamily: FONT.display, fontSize: '44px', color: HEX.parchment })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(81);
    this.add
      .text(width / 2, height * 0.4 + 64, sub, { fontFamily: FONT.ui, fontSize: '20px', color: subColor })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(81);
    makeButton(this, width / 2, height * 0.6, 320, 70, 'BACK TO MAP', () => this.scene.start('Map'), '20px')
      .setScrollFactor(0)
      .setDepth(81);
  }
}
