import Phaser from 'phaser';
import { speciesById, SpeciesDef } from '../data/species';
import { LassoLine } from '../capture/LassoLine';
import { ArenaRect, CreatureActor } from '../capture/CreatureActor';
import { dist, distPointToSegment, pointInPolygon, Vec2 } from '../capture/geometry';
import { makeButton } from '../ui/button';
import { gameState, newCritter } from '../state/GameState';
import { ensureIcons } from '../ui/icons';
import { gaugeDecayDelay, gaugeDecayRate, healthBars, ropeBudget } from '../data/lassoUpgrades';
import { EVOLVED_IDS, evoStage } from '../data/evolutions';
import { STAGE_THEMES } from '../data/stages';
import { playMusic, sfx } from '../audio/audio';

// Tuning knobs for the capture mini-game live here. Rope budget, health
// bars, and gauge decay are now functions of the lasso upgrade levels -
// see src/data/lassoUpgrades.ts for the base values and per-level effects.
const MIN_POINT_DIST = 8;
const LINE_WIDTH = 7;

// rope palette matched to the hand-drawn logo: solid tan rope with dark
// twist ticks and a deep outline
const ROPE_OUTLINE = 0x4a2a12;
const ROPE_BASE = 0xd29a55;
const ROPE_TICK = 0x6b3a1e;
const ROPE_TICK_SPACING = 13; // px of arclength between twist ticks

const GAUGE_PER_LOOP = 10; // capture gauge points shown per completed loop
const GAUGE_W = 120; // inner fill width of the capture gauge
const CAPTURE_REWARD = 25; // Gold paid out per successful wrangle

// Every capture target fights back now, flavored by its behavior. The
// interval scales by evolution stage (basics are meeker) and boss status.
const AGGRO_INTERVAL_MS: Record<string, number> = { graze: 9500, flee: 11500, charge: 7500 };
const AGGRO_STAGE_MULT = [1.35, 1, 0.75]; // basic / mid / final
const AGGRO_BOSS_MULT = 0.65;
// Ring reach by behavior: skittish fleers startle small, chargers hit wide
const RING_MAX_R: Record<string, number> = { graze: 230, flee: 175, charge: 265 };

// Consecutive-loop combo (a la Shadows of Almia): 5 straight loops heat the
// rope to x1.5 gauge per loop, 10 straight = x2. Any break or release cools
// it. Barely matters on 2-4 loop critters; decisive on high-loop ones.
const COMBO_HOT_AT = 5;
const COMBO_BLAZING_AT = 10;

interface Ring {
  x: number;
  y: number;
  r: number;
  prevR: number;
  maxR: number;
  speed: number;
  damage: number;
}

export class CaptureScene extends Phaser.Scene {
  private species!: SpeciesDef;
  private arena!: ArenaRect;
  private creature!: CreatureActor;
  private creatureImg!: Phaser.GameObjects.Image;
  private alertText!: Phaser.GameObjects.Text;
  private line!: LassoLine;
  private rings: Ring[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  /** Max/remaining health in whole bars (max comes from the GRIT upgrade). */
  private healthMax = 5;
  private health = 5;
  /** Capture progress in loop units (float — decays over time). */
  private gaugeProgress = 0;
  private decayDelayS = 4;
  private decayRatePerS = 0.75;
  private decayCountdown = 4;
  /** Consecutive loops without a break/release. */
  private streak = 0;
  private phase: 'active' | 'won' | 'lost' = 'active';
  private telegraphing = false;

  private gauge!: Phaser.GameObjects.Container;
  private gaugeFillG!: Phaser.GameObjects.Graphics;
  private healthCells: Phaser.GameObjects.Container[] = [];
  private toast!: Phaser.GameObjects.Text;
  private toastTween?: Phaser.Tweens.Tween;
  /** True when launched mid-stage - exits wake the sleeping StageScene. */
  private fromStage = false;
  private stageThemeId?: string;
  private bossCapture = false;
  private creatureBaseScale = 1;
  /** Line breaks this attempt (body snaps + attacks) - 0 = a clean catch. */
  private lineBreaks = 0;

  constructor() {
    super('Capture');
  }

  init(data: { speciesId: string; fromStage?: boolean; themeId?: string; boss?: boolean }): void {
    this.species = speciesById(data.speciesId);
    this.fromStage = data.fromStage ?? false;
    this.stageThemeId = data.themeId;
    this.bossCapture = data.boss ?? false;
    // Scene objects persist across restarts — reset all round state here.
    const lasso = gameState.data.lasso;
    this.line = new LassoLine(ropeBudget(lasso.rope));
    this.healthMax = healthBars(lasso.grit);
    this.decayDelayS = gaugeDecayDelay(lasso.charge);
    this.decayRatePerS = gaugeDecayRate(lasso.charge);
    this.rings = [];
    this.health = this.healthMax;
    this.gaugeProgress = 0;
    this.decayCountdown = this.decayDelayS;
    this.streak = 0;
    this.phase = 'active';
    this.telegraphing = false;
    this.healthCells = [];
    this.toastTween = undefined;
    this.lineBreaks = 0;
  }

  create(): void {
    ensureIcons(this);
    // this encounter counts as "seen" in the Frontier Ledger
    gameState.data.seen[this.species.id] = (gameState.data.seen[this.species.id] ?? 0) + 1;
    gameState.save();
    const { width, height } = this.scale;
    this.arena = { left: 30, top: 120, right: width - 30, bottom: height - 140 };
    // mid-stage captures take the stage's ground color as their backdrop
    const theme = this.stageThemeId ? STAGE_THEMES[this.stageThemeId] : undefined;
    if (theme) this.cameras.main.setBackgroundColor(theme.captureBg);
    else this.cameras.main.setBackgroundColor('#d9a066');
    this.drawArena();
    playMusic('lasso');

    // hostility: interval by behavior, scaled by evolution stage + boss
    const stage = evoStage(this.species.id);
    const aggroMs =
      (this.species.attackIntervalMs ?? AGGRO_INTERVAL_MS[this.species.movement] ?? 9500) *
      (AGGRO_STAGE_MULT[stage] ?? 1) *
      (this.bossCapture ? AGGRO_BOSS_MULT : 1);
    this.creature = new CreatureActor(
      this.species,
      { x: width / 2, y: (this.arena.top + this.arena.bottom) / 2 },
      this.arena,
      { intervalMs: aggroMs }
    );
    this.creature.onTelegraph = () => {
      this.telegraphing = true;
      this.alertText.setVisible(true);
    };
    this.creature.onAttack = (origin) => {
      this.telegraphing = false;
      this.alertText.setVisible(false);
      this.rings.push({
        x: origin.x,
        y: origin.y,
        r: this.species.bodyRadius,
        prevR: this.species.bodyRadius,
        maxR: this.species.ringMaxR ?? RING_MAX_R[this.species.movement] ?? 230,
        speed: this.species.ringSpeed ?? 420,
        damage: this.species.attackDamage ?? 1
      });
    };

    this.gfx = this.add.graphics().setDepth(1);
    const texKey = this.textures.exists(this.species.textureKey) ? this.species.textureKey : 'pl-unknown';
    // every critter draws at the same fixed size (~the gauge bar's width);
    // bosses at 1.5x. Gameplay radius unchanged.
    this.creatureImg = this.add.image(this.creature.pos.x, this.creature.pos.y, texKey).setDepth(2);
    const targetSize = this.bossCapture ? 189 : 126;
    this.creatureImg.setDisplaySize(targetSize, targetSize);
    this.creatureBaseScale = this.creatureImg.scaleX;
    this.alertText = this.add
      .text(0, 0, '!', { fontFamily: 'Silkscreen', fontSize: '44px', color: '#e01c1c' })
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);

    // Capture gauge that follows below the creature; each loop adds +10.
    // Western frame: ink outline, wood surround, corner rivets, and a fill
    // drawn as coiled rope (tan bands with dark twist ticks).
    const frame = this.add.graphics();
    const fw = GAUGE_W + 16;
    frame.fillStyle(0x2b221a);
    frame.fillRect(-fw / 2 - 2, -13, fw + 4, 26);
    frame.fillStyle(0x5c3720);
    frame.fillRect(-fw / 2, -11, fw, 22);
    frame.fillStyle(0x140a05);
    frame.fillRect(-GAUGE_W / 2 - 2, -7, GAUGE_W + 4, 14);
    frame.fillStyle(0xcfa96f);
    frame.fillRect(-fw / 2, -11, 3, 3);
    frame.fillRect(fw / 2 - 3, -11, 3, 3);
    frame.fillRect(-fw / 2, 8, 3, 3);
    frame.fillRect(fw / 2 - 3, 8, 3, 3);
    this.gaugeFillG = this.add.graphics();
    this.gauge = this.add.container(0, 0, [frame, this.gaugeFillG]).setDepth(3);

    this.buildHud();
    this.bindInput();
  }

  update(_time: number, deltaMs: number): void {
    if (this.phase !== 'active') return;
    const dt = Math.min(deltaMs, 50) / 1000;

    const ap = this.input.activePointer;
    this.creature.update(dt, { x: ap.x, y: ap.y, down: ap.isDown });
    this.creatureImg.setPosition(this.creature.pos.x, this.creature.pos.y);
    this.alertText.setPosition(this.creature.pos.x, this.creature.pos.y - this.creature.radius - 34);
    this.gauge.setPosition(this.creature.pos.x, this.creature.pos.y + this.creature.radius + 26);

    if (this.telegraphing) {
      this.creatureImg.setTint(0xff9999);
    } else {
      this.creatureImg.clearTint();
    }

    this.tickGaugeDecay(dt);
    this.updateRings(dt);
    if (this.line.active) this.checkBodyCollision();
    this.redraw();
    this.updateHud();
  }

  // ---------- input ----------

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.phase !== 'active') return;
      const a = this.arena;
      if (p.x < a.left || p.x > a.right || p.y < a.top || p.y > a.bottom) return;
      this.line.start({ x: p.x, y: p.y });
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.phase !== 'active' || !p.isDown || !this.line.active) return;
      const px = Phaser.Math.Clamp(p.x, this.arena.left, this.arena.right);
      const py = Phaser.Math.Clamp(p.y, this.arena.top, this.arena.bottom);
      const res = this.line.extend({ x: px, y: py }, MIN_POINT_DIST);
      // res.overflow now means the rope's back end is paying out (visible
      // tail retraction, original-Ranger styler behavior) - no snap.
      if (res.loop && pointInPolygon(this.creature.pos, res.loop)) {
        this.bankLoop();
      }
    });

    // Releasing simply drops the line — the pressure comes from gauge decay
    // (and the hot-rope streak cools off).
    this.input.on('pointerup', () => {
      if (this.phase === 'active') {
        this.line.clear();
        this.streak = 0;
      }
    });
  }

  // ---------- capture logic ----------

  private bankLoop(): void {
    // hot-rope combo multiplier applies to loops AFTER the streak threshold
    const mult = this.streak >= COMBO_BLAZING_AT ? 2 : this.streak >= COMBO_HOT_AT ? 1.5 : 1;
    this.streak++;
    this.gaugeProgress = Math.min(this.species.requiredLoops, this.gaugeProgress + mult);
    this.decayCountdown = this.decayDelayS;
    sfx('loop');
    this.popGaugeGain(Math.round(GAUGE_PER_LOOP * mult), mult > 1);
    // squash-pop relative to the normalized base draw scale
    this.creatureImg.setScale(this.creatureBaseScale * 1.12);
    this.tweens.add({ targets: this.creatureImg, scale: this.creatureBaseScale, duration: 150 });
    if (this.gaugeProgress >= this.species.requiredLoops - 1e-9) {
      this.finish(true);
    }
  }

  private tickGaugeDecay(dt: number): void {
    if (this.gaugeProgress <= 0) return;
    this.decayCountdown -= dt;
    if (this.decayCountdown <= 0) {
      this.gaugeProgress = Math.max(0, this.gaugeProgress - this.decayRatePerS * dt);
    }
  }

  /** Floating number above the top-right of the capture gauge: points added. */
  private popGaugeGain(amount: number, hot: boolean): void {
    const t = this.add
      .text(
        this.creature.pos.x + GAUGE_W / 2 + 6,
        this.creature.pos.y + this.creature.radius + 4,
        `+${amount}`,
        {
          fontFamily: 'Silkscreen',
          fontSize: hot ? '34px' : '28px',
          color: '#ffffff'
        }
      )
      .setOrigin(0.5)
      .setDepth(12);
    this.tweens.add({
      targets: t,
      y: t.y - 50,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy()
    });
  }

  private checkBodyCollision(): void {
    const pts = this.line.points;
    const hitDist = this.creature.radius + LINE_WIDTH;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distPointToSegment(this.creature.pos, pts[i], pts[i + 1]) <= hitDist) {
        // body snaps the rope (and cools the streak) but capture progress
        // is kept - only attacks empty the gauge
        this.breakLine('SNAPPED!', false);
        return;
      }
    }
  }

  private updateRings(dt: number): void {
    for (const ring of this.rings) {
      ring.prevR = ring.r;
      ring.r += ring.speed * dt;
      if (this.line.active && this.ringHitsLine(ring)) {
        this.gaugeProgress = 0;
        this.health = Math.max(0, this.health - ring.damage);
        this.cameras.main.shake(150, 0.01);
        this.breakLine(`-${ring.damage} HEALTH BAR${ring.damage > 1 ? 'S' : ''}!`, true);
        if (this.health <= 0) {
          this.finish(false);
          return;
        }
      }
    }
    this.rings = this.rings.filter((r) => r.r < r.maxR);
  }

  private ringHitsLine(ring: Ring): boolean {
    const pts = this.line.points;
    const center: Vec2 = { x: ring.x, y: ring.y };
    const inner = ring.prevR - LINE_WIDTH;
    const outer = ring.r + LINE_WIDTH;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distPointToSegment(center, pts[i], pts[i + 1]);
      if (d >= inner && d <= outer) return true;
    }
    return false;
  }

  private breakLine(msg: string, isAttack: boolean): void {
    this.line.clear();
    this.streak = 0;
    this.lineBreaks++;
    sfx('snap');
    this.showToast(msg, isAttack ? '#e05c4a' : '#ffe9c9');
  }

  private finish(won: boolean): void {
    this.phase = won ? 'won' : 'lost';
    this.line.clear();
    this.gfx.clear();
    this.alertText.setVisible(false);
    this.creatureImg.clearTint();
    this.updateHud();

    if (won) {
      // into the herd as a unique individual (fresh pedigree roll), plus pay
      gameState.data.herd.push(newCritter(this.species.id));
      gameState.data.currency += CAPTURE_REWARD;
      // bounty board daily tallies
      gameState.bumpQuest('catches');
      gameState.bumpQuest('goldEarned', CAPTURE_REWARD);
      for (const t of [this.species.type1, this.species.type2]) {
        if (t) gameState.bumpQuest(`catchType_${t}`);
      }
      if (EVOLVED_IDS.has(this.species.id)) gameState.bumpQuest('rareCatch');
      if (this.bossCapture) gameState.bumpQuest('bossCatch');
      if (this.lineBreaks === 0) gameState.bumpQuest('cleanCatch');
      gameState.save();
      this.tweens.add({
        targets: this.creatureImg,
        y: this.creatureImg.y - 30,
        duration: 200,
        yoyo: true,
        repeat: 2
      });
    }

    sfx(won ? 'capture' : 'bust');
    this.time.delayedCall(500, () => {
      const { width, height } = this.scale;
      this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(20);
      this.add
        .text(width / 2, height * 0.4, won ? 'WRANGLED!' : 'LASSO BUSTED', {
          fontFamily: 'Silkscreen',
          fontSize: '52px',
          color: won ? '#f4a340' : '#e05c4a'
        })
        .setOrigin(0.5)
        .setDepth(21);
      if (won) {
        this.add.image(width / 2 - 42, height * 0.4 + 62, 'icon-coin').setTint(0xb8912a).setDepth(21);
        this.add
          .text(width / 2 - 14, height * 0.4 + 62, `+${CAPTURE_REWARD}`, {
            fontFamily: 'Silkscreen',
            fontSize: '26px',
            color: '#b8912a'
          })
          .setOrigin(0, 0.5)
          .setDepth(21);
      }
      if (this.fromStage) {
        // mid-stage: one shot at the lasso, then back to the trail
        makeButton(this, width / 2, height * 0.57, 340, 70, 'BACK TO THE TRAIL', () =>
          this.exitToStage()
        ).setDepth(21);
        return;
      }
      makeButton(this, width / 2, height * 0.57, 320, 70, 'TRY AGAIN', () =>
        this.scene.restart({ speciesId: this.species.id })
      ).setDepth(21);
      makeButton(this, width / 2, height * 0.57 + 100, 320, 70, 'PICK TARGET', () => {
        playMusic('home'); // back to the menus - drop the lasso tune
        this.scene.start('CaptureSelect', { tab: 'tally' });
      }).setDepth(21);
    });
  }

  /** Return to the sleeping StageScene exactly where the run left off. */
  private exitToStage(): void {
    this.scene.wake('Stage');
    this.scene.stop();
  }

  // ---------- rendering ----------

  /** Open range - speckled floor only, no drawn pen (bounds still apply). */
  private drawArena(): void {
    const a = this.arena;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0xc9945a);
    for (let i = 0; i < 60; i++) {
      const x = a.left + Math.random() * (a.right - a.left);
      const y = a.top + Math.random() * (a.bottom - a.top);
      g.fillCircle(x, y, 2 + Math.random() * 3);
    }
  }

  private redraw(): void {
    this.gfx.clear();

    for (const ring of this.rings) {
      const fade = 1 - ring.r / ring.maxR;
      this.gfx.lineStyle(8, 0xe05c4a, 0.3 + 0.7 * fade);
      this.gfx.strokeCircle(ring.x, ring.y, ring.r);
    }

    const pts = this.line.points;
    if (pts.length > 0) {
      if (pts.length > 1) {
        // matched to the hand-drawn logo rope: deep outline, solid tan
        // rope, then short dark twist ticks across it at regular intervals
        this.gfx.lineStyle(LINE_WIDTH + 3, ROPE_OUTLINE, 1);
        this.strokePolyline(pts);
        this.gfx.lineStyle(LINE_WIDTH, ROPE_BASE, 1);
        this.strokePolyline(pts);
        this.drawRopeTicks(pts);
      }
      // knot at the anchor point, like the logo's wrapped knots
      this.gfx.fillStyle(ROPE_OUTLINE, 1);
      this.gfx.fillCircle(pts[0].x, pts[0].y, 9);
      this.gfx.fillStyle(ROPE_BASE, 1);
      this.gfx.fillCircle(pts[0].x, pts[0].y, 6);
      this.gfx.fillStyle(ROPE_TICK, 1);
      this.gfx.fillRect(pts[0].x - 5, pts[0].y - 1.5, 10, 3);
    }
  }

  private strokePolyline(pts: readonly Vec2[]): void {
    this.gfx.beginPath();
    this.gfx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) this.gfx.lineTo(pts[i].x, pts[i].y);
    this.gfx.strokePath();
  }

  /** Short dark dashes across the rope every few px - the logo's twists. */
  private drawRopeTicks(pts: readonly Vec2[]): void {
    const half = LINE_WIDTH / 2 + 1;
    let arc = 0;
    let nextTick = ROPE_TICK_SPACING;
    this.gfx.lineStyle(3, ROPE_TICK, 1);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const segLen = dist(a, b);
      if (segLen < 1e-6) continue;
      const dx = (b.x - a.x) / segLen;
      const dy = (b.y - a.y) / segLen;
      while (nextTick <= arc + segLen) {
        const t = nextTick - arc;
        const px = a.x + dx * t;
        const py = a.y + dy * t;
        // slightly slanted across the rope, like a twist in the strands
        const nx = -dy + dx * 0.35;
        const ny = dx + dy * 0.35;
        this.gfx.lineBetween(px - nx * half, py - ny * half, px + nx * half, py + ny * half);
        nextTick += ROPE_TICK_SPACING;
      }
      arc += segLen;
    }
  }

  // ---------- HUD ----------

  private buildHud(): void {
    const { width, height } = this.scale;
    const g = this.add.graphics().setDepth(10);

    // leather panels with stitched edges, top and bottom
    this.drawLeatherPanel(g, 0, 0, width, 100);
    this.drawLeatherPanel(g, 0, height - 120, width, 120);

    this.add
      .text(30, 34, this.species.name, { fontFamily: 'Silkscreen', fontSize: '26px', color: '#ffe9c9' })
      .setDepth(11);
    makeButton(this, width - 80, 50, 110, 50, 'BACK', () => {
      if (this.fromStage) this.exitToStage();
      else this.scene.start('CaptureSelect', { tab: 'tally' });
    }, '16px').setDepth(11);

    // HEALTH as a bandolier: leather strap with red cartridge shells in
    // loops. Losing a bar = an empty loop. Layout adapts to GRIT bar count.
    this.add
      .text(30, height - 70, 'HEALTH', { fontFamily: 'Silkscreen', fontSize: '16px', color: '#e8d5b0' })
      .setDepth(11);
    const cy = height - 60;
    const x0 = 170;
    const slotW = Math.min(64, Math.floor((width - x0 - 40) / this.healthMax));
    const shellW = 22;
    const shellH = 38;
    const strapW = slotW * (this.healthMax - 1) + shellW + 36;
    // the strap itself
    g.fillStyle(0x140905);
    g.fillRect(x0 - 20, cy - 8, strapW, 20);
    g.fillStyle(0x40281a);
    g.fillRect(x0 - 20, cy - 10, strapW, 20);
    const gOver = this.add.graphics().setDepth(12);
    for (let i = 0; i < this.healthMax; i++) {
      const x = x0 + i * slotW; // shell center
      // socket behind the shell (shows when the shell is gone)
      g.fillStyle(0x140a05);
      g.fillRect(x - shellW / 2, cy - shellH / 2, shellW, shellH);
      // red cartridge shell (kept red per design), square pixel shapes
      const tip = this.add.rectangle(x, cy - shellH / 2 + 4, 14, 8, 0xe86a55);
      const body = this.add.rectangle(x, cy - 1, shellW - 2, 18, 0xd1342a);
      const edge = this.add.rectangle(x - shellW / 2 + 3, cy - 1, 4, 18, 0xe86a55);
      const base = this.add.rectangle(x, cy + shellH / 2 - 5, shellW - 2, 10, 0x8f1f18);
      const cell = this.add.container(0, 0, [tip, body, edge, base]).setDepth(11);
      this.healthCells.push(cell);
      // belt loop over the shell (always visible, holds the empty socket too)
      gOver.fillStyle(0x5c3720);
      gOver.fillRect(x - shellW / 2 - 4, cy - 4, shellW + 8, 12);
      gOver.fillStyle(0x8a6a45);
      gOver.fillRect(x - shellW / 2 - 2, cy, 3, 3);
      gOver.fillRect(x + shellW / 2 - 1, cy, 3, 3);
    }

    this.toast = this.add
      .text(width / 2, (this.arena.top + this.arena.bottom) / 2 - 160, '', {
        fontFamily: 'Silkscreen',
        fontSize: '28px',
        color: '#ffe9c9'
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(0);
  }

  private drawLeatherPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(0x2a1a10);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x40281a); // top edge highlight
    g.fillRect(x, y, w, 4);
    g.fillStyle(0x140905); // bottom edge shadow
    g.fillRect(x, y + h - 4, w, 4);
    // stitching
    g.fillStyle(0x8a6a45);
    for (let sx = x + 12; sx < x + w - 20; sx += 26) {
      g.fillRect(sx, y + 9, 12, 3);
      g.fillRect(sx, y + h - 12, 12, 3);
    }
  }

  private updateHud(): void {
    for (let i = 0; i < this.healthCells.length; i++) {
      this.healthCells[i].setVisible(i < this.health);
    }
    // gauge fill: solid rope-tan bar (no segmentation)
    const frac = Math.min(1, this.gaugeProgress / this.species.requiredLoops);
    const fillW = Math.round(GAUGE_W * frac);
    const g = this.gaugeFillG;
    g.clear();
    if (fillW > 0) {
      g.fillStyle(ROPE_BASE);
      g.fillRect(-GAUGE_W / 2, -5, fillW, 10);
    }
  }

  private showToast(msg: string, color: string): void {
    this.toastTween?.remove();
    this.toast.setText(msg).setColor(color).setAlpha(1);
    this.toastTween = this.tweens.add({
      targets: this.toast,
      alpha: 0,
      delay: 700,
      duration: 400
    });
  }
}
