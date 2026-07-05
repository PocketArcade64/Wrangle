import Phaser from 'phaser';
import { speciesById, SpeciesDef } from '../data/species';
import { LassoLine } from '../capture/LassoLine';
import { CreatureActor } from '../capture/CreatureActor';
import { distPointToSegment, pointInPolygon, Vec2 } from '../capture/geometry';
import { makeButton } from '../ui/button';

// Tuning knobs for the capture mini-game live here.
const ARENA = { left: 30, top: 190, right: 690, bottom: 1080 };
const LINE_BUDGET = 1600; // px of rope per loop
const MIN_POINT_DIST = 8;
const LINE_WIDTH = 5;
const GRIT_MAX = 100;
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

  private pips: Phaser.GameObjects.Arc[] = [];
  private gritFill!: Phaser.GameObjects.Rectangle;
  private inkFill!: Phaser.GameObjects.Rectangle;
  private inkLabel!: Phaser.GameObjects.Text;
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
    this.pips = [];
    this.toastTween = undefined;
  }

  create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor('#d9a066');
    this.drawArena();

    this.creature = new CreatureActor(
      this.species,
      { x: width / 2, y: (ARENA.top + ARENA.bottom) / 2 },
      ARENA
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
      if (p.x < ARENA.left || p.x > ARENA.right || p.y < ARENA.top || p.y > ARENA.bottom) return;
      this.line.start({ x: p.x, y: p.y });
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.phase !== 'active' || !p.isDown || !this.line.active) return;
      const px = Phaser.Math.Clamp(p.x, ARENA.left, ARENA.right);
      const py = Phaser.Math.Clamp(p.y, ARENA.top, ARENA.bottom);
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
    this.creatureImg.setScale(1.15);
    this.tweens.add({ targets: this.creatureImg, scale: 1, duration: 150 });
    if (this.banked >= this.species.requiredLoops) {
      this.finish(true);
    } else {
      this.showToast('LOOP!', '#f4a340');
    }
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
    const g = this.add.graphics().setDepth(0);
    // speckled desert floor
    g.fillStyle(0xc9945a);
    for (let i = 0; i < 60; i++) {
      const x = ARENA.left + Math.random() * (ARENA.right - ARENA.left);
      const y = ARENA.top + Math.random() * (ARENA.bottom - ARENA.top);
      g.fillCircle(x, y, 2 + Math.random() * 3);
    }
    g.lineStyle(5, 0x5a3a22);
    g.strokeRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top);
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
    const { width } = this.scale;
    this.add.rectangle(width / 2, 85, width, 170, 0x2a1a10).setDepth(10);

    this.add
      .text(30, 24, this.species.name, { fontFamily: 'Silkscreen', fontSize: '26px', color: '#ffffff' })
      .setDepth(11);

    for (let i = 0; i < this.species.requiredLoops; i++) {
      const pip = this.add
        .circle(42 + i * 34, 78, 11, 0x2a1a10)
        .setStrokeStyle(3, 0xf4a340)
        .setDepth(11);
      this.pips.push(pip);
    }

    this.add
      .text(30, 104, 'GRIT', { fontFamily: 'Silkscreen', fontSize: '16px', color: '#c9b49a' })
      .setDepth(11);
    this.add.rectangle(110, 112, 260, 18, 0x1a0f08).setOrigin(0, 0.5).setDepth(11);
    this.gritFill = this.add.rectangle(110, 112, 260, 18, 0xe05c4a).setOrigin(0, 0.5).setDepth(11);

    makeButton(this, width - 80, 60, 110, 50, 'BACK', () => this.scene.start('CaptureSelect'), '16px').setDepth(11);

    this.inkLabel = this.add
      .text(width / 2 - 250, 1140, 'ROPE', { fontFamily: 'Silkscreen', fontSize: '16px', color: '#5a3a22' })
      .setDepth(11)
      .setVisible(false);
    this.add.rectangle(width / 2 - 170, 1148, 420, 14, 0x5a3a22).setOrigin(0, 0.5).setDepth(10);
    this.inkFill = this.add
      .rectangle(width / 2 - 170, 1148, 420, 14, 0xc98d4b)
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.toast = this.add
      .text(width / 2, 640, '', { fontFamily: 'Silkscreen', fontSize: '28px', color: '#ffe9c9' })
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(0);
  }

  private updateHud(): void {
    for (let i = 0; i < this.pips.length; i++) {
      this.pips[i].setFillStyle(i < this.banked ? 0xf4a340 : 0x2a1a10);
    }
    this.gritFill.scaleX = this.grit / GRIT_MAX;
    this.inkFill.scaleX = this.line.active ? this.line.remainingFraction : 1;
    this.inkLabel.setVisible(this.line.active);
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
