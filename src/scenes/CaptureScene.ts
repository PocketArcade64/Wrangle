import Phaser from 'phaser';
import { speciesById, SpeciesDef } from '../data/species';
import { LassoLine } from '../capture/LassoLine';
import { ArenaRect, CreatureActor } from '../capture/CreatureActor';
import { distPointToSegment, pointInPolygon, Vec2 } from '../capture/geometry';
import { makeButton } from '../ui/button';

// Tuning knobs for the capture mini-game live here.
const LINE_BUDGET = 1600; // max total rope length on the field
const MIN_POINT_DIST = 8;
const LINE_WIDTH = 5;
const GRIT_MAX = 100;
const GRIT_SEGMENTS = 5;
const GAUGE_PER_LOOP = 10; // capture gauge points per completed loop
const STUN_SECONDS = 1.2;

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
  private grit = GRIT_MAX;
  private banked = 0;
  private phase: 'active' | 'won' | 'lost' = 'active';
  private telegraphing = false;

  private gauge!: Phaser.GameObjects.Container;
  private gaugeFill!: Phaser.GameObjects.Rectangle;
  private gritFills: Phaser.GameObjects.Rectangle[] = [];
  private inkFill!: Phaser.GameObjects.Rectangle;
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
    this.grit = GRIT_MAX;
    this.banked = 0;
    this.phase = 'active';
    this.telegraphing = false;
    this.gritFills = [];
    this.toastTween = undefined;
  }

  create(): void {
    const { width, height } = this.scale;
    this.arena = { left: 30, top: 120, right: width - 30, bottom: height - 180 };
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
        damage: this.species.attackDamage ?? 20
      });
    };

    this.gfx = this.add.graphics().setDepth(1);
    this.creatureImg = this.add.image(this.creature.pos.x, this.creature.pos.y, this.species.textureKey).setDepth(2);
    this.alertText = this.add
      .text(0, 0, '!', { fontFamily: 'Silkscreen', fontSize: '44px', color: '#e01c1c' })
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);

    // Capture gauge that follows below the creature; each loop adds +10.
    const gaugeBg = this.add.rectangle(0, 0, 124, 14, 0x1a0f08).setStrokeStyle(2, 0x3a2a1a);
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

    if (this.creature.isStunned()) {
      this.creatureImg.setTint(0x8fb7ff);
    } else if (this.telegraphing) {
      this.creatureImg.setTint(0xff9999);
    } else {
      this.creatureImg.clearTint();
    }

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
        this.breakLine('TOO MUCH ROPE!', false);
        return;
      }
      if (res.loop && pointInPolygon(this.creature.pos, res.loop)) {
        if (this.creature.isStunned()) {
          this.showToast('NO EFFECT WHILE STUNNED', '#c9b49a');
        } else {
          this.bankLoop();
        }
      }
    });

    this.input.on('pointerup', () => this.handleRelease());
  }

  private handleRelease(): void {
    if (this.phase !== 'active' || !this.line.active) return;
    this.line.clear();
    if (this.banked > 0) {
      this.creature.stun(STUN_SECONDS);
      this.showToast("IT'S DAZED... AND GETTIN' RILED!", '#8fb7ff');
    }
  }

  // ---------- capture logic ----------

  private bankLoop(): void {
    this.banked++;
    this.popGaugeGain();
    this.creatureImg.setScale(1.15);
    this.tweens.add({ targets: this.creatureImg, scale: 1, duration: 150 });
    if (this.banked >= this.species.requiredLoops) {
      this.finish(true);
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
        this.banked = 0;
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
        this.banked = 0;
        this.grit = Math.max(0, this.grit - ring.damage);
        this.cameras.main.shake(150, 0.01);
        this.breakLine(`-${ring.damage} GRIT!`, true);
        if (this.grit <= 0) {
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
      makeButton(this, width / 2, height * 0.55, 320, 70, 'TRY AGAIN', () =>
        this.scene.restart({ speciesId: this.species.id })
      ).setDepth(21);
      makeButton(this, width / 2, height * 0.55 + 100, 320, 70, 'PICK TARGET', () =>
        this.scene.start('CaptureSelect')
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
        this.gfx.lineStyle(LINE_WIDTH, 0xc98d4b, 1);
        this.gfx.beginPath();
        this.gfx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.gfx.lineTo(pts[i].x, pts[i].y);
        this.gfx.strokePath();
      }
      // knot at the anchor point
      this.gfx.fillStyle(0x8a5a2b, 1);
      this.gfx.fillCircle(pts[0].x, pts[0].y, 7);
    }
  }

  // ---------- HUD ----------

  private buildHud(): void {
    const { width, height } = this.scale;

    // top strip: name + back
    this.add.rectangle(width / 2, 50, width, 100, 0x2a1a10).setDepth(10);
    this.add
      .text(30, 34, this.species.name, { fontFamily: 'Silkscreen', fontSize: '26px', color: '#ffffff' })
      .setDepth(11);
    makeButton(this, width - 80, 50, 110, 50, 'BACK', () => this.scene.start('CaptureSelect'), '16px').setDepth(11);

    // bottom strip: rope meter + segmented GRIT
    this.add.rectangle(width / 2, height - 80, width, 160, 0x2a1a10).setDepth(10);

    this.add
      .text(30, height - 133, 'ROPE', { fontFamily: 'Silkscreen', fontSize: '16px', color: '#c9b49a' })
      .setDepth(11);
    this.add.rectangle(110, height - 125, 420, 14, 0x1a0f08).setOrigin(0, 0.5).setDepth(11);
    this.inkFill = this.add
      .rectangle(110, height - 125, 420, 14, 0xc98d4b)
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.add
      .text(30, height - 78, 'GRIT', { fontFamily: 'Silkscreen', fontSize: '16px', color: '#c9b49a' })
      .setDepth(11);
    const segW = 78;
    const gap = 8;
    for (let i = 0; i < GRIT_SEGMENTS; i++) {
      const x = 110 + i * (segW + gap);
      this.add
        .rectangle(x, height - 70, segW, 24, 0x1a0f08)
        .setOrigin(0, 0.5)
        .setStrokeStyle(2, 0x5a3a22)
        .setDepth(11);
      const fill = this.add
        .rectangle(x + 2, height - 70, segW - 4, 18, 0xe05c4a)
        .setOrigin(0, 0.5)
        .setDepth(11);
      this.gritFills.push(fill);
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

  private updateHud(): void {
    this.inkFill.scaleX = this.line.active ? this.line.remainingFraction : 1;
    const perSeg = GRIT_MAX / GRIT_SEGMENTS;
    for (let i = 0; i < this.gritFills.length; i++) {
      const segHp = Phaser.Math.Clamp(this.grit - i * perSeg, 0, perSeg);
      this.gritFills[i].scaleX = segHp / perSeg;
    }
    this.gaugeFill.scaleX = Math.min(1, this.banked / this.species.requiredLoops);
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
