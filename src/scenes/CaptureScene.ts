import Phaser from 'phaser';
import { speciesById, SpeciesDef } from '../data/species';
import { LassoLine } from '../capture/LassoLine';
import { ArenaRect, CreatureActor } from '../capture/CreatureActor';
import { dist, distPointToSegment, pointInPolygon, Vec2 } from '../capture/geometry';
import { makeButton } from '../ui/button';
import { gameState } from '../state/GameState';
import { ensureIcons } from '../ui/icons';

// Tuning knobs for the capture mini-game live here.
// Hidden rope budget (no meter shown, per design): max total line length on
// the field. ~2.5 comfortable loops around a default creature, mirroring
// Almia's starting styler line. Closing a loop refunds its length; future
// lasso upgrades raise this.
const LINE_BUDGET = 1500;
const MIN_POINT_DIST = 8;
const LINE_WIDTH = 7;
const HEALTH_SEGMENTS = 5; // health is whole bars; attacks remove whole bars

// rope palette (striped like a real lasso)
const ROPE_OUTLINE = 0x4a2f16;
const ROPE_LIGHT = 0xdca85e;
const ROPE_DARK = 0xa8722f;
const ROPE_BAND_LEN = 14; // px of arclength per stripe
const GAUGE_PER_LOOP = 10; // capture gauge points shown per completed loop
const CAPTURE_REWARD = 25; // Dust paid out per successful wrangle
const GAUGE_DECAY_DELAY_S = 4; // seconds without a loop before decay kicks in
const GAUGE_DECAY_PER_S = 0.75; // loops' worth of gauge drained per second

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
  /** Remaining health, counted in whole bars. */
  private health = HEALTH_SEGMENTS;
  /** Capture progress in loop units (float — decays over time). */
  private gaugeProgress = 0;
  private decayCountdown = GAUGE_DECAY_DELAY_S;
  private phase: 'active' | 'won' | 'lost' = 'active';
  private telegraphing = false;

  private gauge!: Phaser.GameObjects.Container;
  private gaugeFill!: Phaser.GameObjects.Rectangle;
  private healthCells: Phaser.GameObjects.Container[] = [];
  private toast!: Phaser.GameObjects.Text;
  private toastTween?: Phaser.Tweens.Tween;

  constructor() {
    super('Capture');
  }

  init(data: { speciesId: string }): void {
    this.species = speciesById(data.speciesId);
    // Scene objects persist across restarts — reset all round state here.
    this.line = new LassoLine(LINE_BUDGET);
    this.rings = [];
    this.health = HEALTH_SEGMENTS;
    this.gaugeProgress = 0;
    this.decayCountdown = GAUGE_DECAY_DELAY_S;
    this.phase = 'active';
    this.telegraphing = false;
    this.healthCells = [];
    this.toastTween = undefined;
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.arena = { left: 30, top: 120, right: width - 30, bottom: height - 140 };
    this.cameras.main.setBackgroundColor('#d9a066');
    this.drawArena();

    this.creature = new CreatureActor(
      this.species,
      { x: width / 2, y: (this.arena.top + this.arena.bottom) / 2 },
      this.arena
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
        maxR: this.species.ringMaxR ?? 230,
        speed: this.species.ringSpeed ?? 420,
        damage: this.species.attackDamage ?? 1
      });
    };

    this.gfx = this.add.graphics().setDepth(1);
    const texKey = this.textures.exists(this.species.textureKey) ? this.species.textureKey : 'pl-unknown';
    this.creatureImg = this.add.image(this.creature.pos.x, this.creature.pos.y, texKey).setDepth(2);
    this.alertText = this.add
      .text(0, 0, '!', { fontFamily: 'Silkscreen', fontSize: '44px', color: '#e01c1c' })
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);

    // Capture gauge that follows below the creature; each loop adds +10.
    const gaugeBg = this.add.rectangle(0, 0, 128, 16, 0x140a05).setStrokeStyle(3, 0x3a2415);
    this.gaugeFill = this.add.rectangle(-60, 0, 120, 10, 0xf4a340).setOrigin(0, 0.5);
    this.gauge = this.add.container(0, 0, [gaugeBg, this.gaugeFill]).setDepth(3);

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
      if (res.overflow) {
        // Ran out of rope (hidden budget) — the line snaps, Ranger-style.
        this.breakLine('TOO MUCH ROPE!', false);
        return;
      }
      if (res.loop && pointInPolygon(this.creature.pos, res.loop)) {
        this.bankLoop();
      }
    });

    // Releasing simply drops the line — the pressure comes from gauge decay.
    this.input.on('pointerup', () => {
      if (this.phase === 'active') this.line.clear();
    });
  }

  // ---------- capture logic ----------

  private bankLoop(): void {
    this.gaugeProgress = Math.min(this.species.requiredLoops, this.gaugeProgress + 1);
    this.decayCountdown = GAUGE_DECAY_DELAY_S;
    this.popGaugeGain();
    this.creatureImg.setScale(1.15);
    this.tweens.add({ targets: this.creatureImg, scale: 1, duration: 150 });
    if (this.gaugeProgress >= this.species.requiredLoops - 1e-9) {
      this.finish(true);
    }
  }

  private tickGaugeDecay(dt: number): void {
    if (this.gaugeProgress <= 0) return;
    this.decayCountdown -= dt;
    if (this.decayCountdown <= 0) {
      this.gaugeProgress = Math.max(0, this.gaugeProgress - GAUGE_DECAY_PER_S * dt);
    }
  }

  private popGaugeGain(): void {
    const t = this.add
      .text(this.creature.pos.x, this.creature.pos.y - this.creature.radius - 60, `+${GAUGE_PER_LOOP}`, {
        fontFamily: 'Silkscreen',
        fontSize: '30px',
        color: '#f4a340'
      })
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
        this.gaugeProgress = 0;
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
      // into the herd, and the critter pays out
      gameState.data.herd.push(this.species.id);
      gameState.data.currency += CAPTURE_REWARD;
      gameState.save();
      this.tweens.add({
        targets: this.creatureImg,
        y: this.creatureImg.y - 30,
        duration: 200,
        yoyo: true,
        repeat: 2
      });
    }

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
      makeButton(this, width / 2, height * 0.57, 320, 70, 'TRY AGAIN', () =>
        this.scene.restart({ speciesId: this.species.id })
      ).setDepth(21);
      makeButton(this, width / 2, height * 0.57 + 100, 320, 70, 'PICK TARGET', () =>
        this.scene.start('CaptureSelect', { tab: 'tally' })
      ).setDepth(21);
    });
  }

  // ---------- rendering ----------

  private drawArena(): void {
    const a = this.arena;
    const g = this.add.graphics().setDepth(0);
    // speckled desert floor
    g.fillStyle(0xc9945a);
    for (let i = 0; i < 60; i++) {
      const x = a.left + Math.random() * (a.right - a.left);
      const y = a.top + Math.random() * (a.bottom - a.top);
      g.fillCircle(x, y, 2 + Math.random() * 3);
    }
    g.lineStyle(5, 0x5a3a22);
    g.strokeRect(a.left, a.top, a.right - a.left, a.bottom - a.top);
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
        // dark outline pass, then alternating light/dark stripes along the
        // rope's arclength for a twisted-lasso look
        this.gfx.lineStyle(LINE_WIDTH + 4, ROPE_OUTLINE, 1);
        this.gfx.beginPath();
        this.gfx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.gfx.lineTo(pts[i].x, pts[i].y);
        this.gfx.strokePath();
        this.drawRopeStripes(pts);
      }
      // knot at the anchor point
      this.gfx.fillStyle(ROPE_OUTLINE, 1);
      this.gfx.fillCircle(pts[0].x, pts[0].y, 9);
      this.gfx.fillStyle(ROPE_LIGHT, 1);
      this.gfx.fillCircle(pts[0].x, pts[0].y, 5);
    }
  }

  private drawRopeStripes(pts: readonly Vec2[]): void {
    let arc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      let a = pts[i];
      const b = pts[i + 1];
      let remaining = dist(a, b);
      while (remaining > 0.5) {
        const intoBand = arc % ROPE_BAND_LEN;
        const step = Math.min(remaining, ROPE_BAND_LEN - intoBand);
        const t = step / remaining;
        const next = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const light = Math.floor(arc / ROPE_BAND_LEN) % 2 === 0;
        this.gfx.lineStyle(LINE_WIDTH, light ? ROPE_LIGHT : ROPE_DARK, 1);
        this.gfx.lineBetween(a.x, a.y, next.x, next.y);
        arc += step;
        remaining -= step;
        a = next;
      }
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
    makeButton(this, width - 80, 50, 110, 50, 'BACK', () => this.scene.start('CaptureSelect', { tab: 'tally' }), '16px').setDepth(11);

    // segmented HEALTH bar: dark wood frames with rivets, red fill w/ bevel
    this.add
      .text(30, height - 70, 'HEALTH', { fontFamily: 'Silkscreen', fontSize: '16px', color: '#e8d5b0' })
      .setDepth(11);
    const segW = 84;
    const gap = 10;
    const cy = height - 60;
    const x0 = 160;
    for (let i = 0; i < HEALTH_SEGMENTS; i++) {
      const x = x0 + i * (segW + gap);
      // frame
      g.fillStyle(0x3a2415);
      g.fillRect(x - 3, cy - 15, segW + 6, 30);
      // empty socket
      g.fillStyle(0x140a05);
      g.fillRect(x, cy - 12, segW, 24);
      // corner rivets
      g.fillStyle(0xcfa96f);
      g.fillRect(x - 3, cy - 15, 3, 3);
      g.fillRect(x + segW, cy - 15, 3, 3);
      g.fillRect(x - 3, cy + 12, 3, 3);
      g.fillRect(x + segW, cy + 12, 3, 3);
      // red fill with pixel bevel (kept red per design)
      const fill = this.add.rectangle(x + 1, cy, segW - 2, 20, 0xd1342a).setOrigin(0, 0.5);
      const shine = this.add.rectangle(x + 1, cy - 7, segW - 2, 4, 0xe86a55).setOrigin(0, 0.5);
      const shade = this.add.rectangle(x + 1, cy + 8, segW - 2, 4, 0x8f1f18).setOrigin(0, 0.5);
      const cell = this.add.container(0, 0, [fill, shine, shade]).setDepth(11);
      this.healthCells.push(cell);
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
    this.gaugeFill.scaleX = Math.min(1, this.gaugeProgress / this.species.requiredLoops);
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
