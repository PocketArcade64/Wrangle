import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { dateKey } from '../util/daily';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';

const TOP_BAR_H = 110;
/** Day 1..7 punch rewards; day 8 starts the card over. */
const PUNCH_REWARDS = [25, 50, 75, 100, 125, 150, 250];
/** Free daily spin wedges (Dust). */
const FREE_WHEEL = [50, 20, 100, 30, 250, 20, 75, 40];
/** Ad-spin wedges - endless but stingier. */
const AD_WHEEL = [10, 5, 25, 5, 50, 10, 15, 5];
const WHEEL_R = 180;

/**
 * Daily bonus: a rail-ticket STAMP CARD (7-day streak, hole-punched each
 * visit) and a FORTUNE WHEEL - an octagonal wagon wheel, spun free once a
 * day; watching an ad (stubbed until the real SDK lands at the M10 wrap)
 * buys extra spins on a lesser reward table.
 */
export class DailyScene extends Phaser.Scene {
  private toastMsg?: string;
  private dustText!: Phaser.GameObjects.Text;
  private wheel!: Phaser.GameObjects.Container;
  private wedgeLabels: Phaser.GameObjects.Text[] = [];
  private spinLabel!: Phaser.GameObjects.Text;
  private spinning = false;
  private freeUsed = false;

  constructor() {
    super('Daily');
  }

  init(data: { toast?: string }): void {
    this.toastMsg = data.toast;
  }

  create(): void {
    ensureIcons(this);
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.spinning = false;
    this.wedgeLabels = [];
    this.freeUsed = gameState.data.daily.lastSpin === dateKey();

    // top bar
    const bar = this.add.graphics();
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => this.scene.start('Home'), '18px');
    this.add
      .text(width / 2 + 30, 55, 'DAILY BONUS', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
      .setOrigin(0.5);
    this.add.image(width - 150, 55, 'icon-coin').setTint(COLORS.brass).setScale(0.8);
    this.dustText = this.add
      .text(width - 122, 55, `${gameState.data.currency}`, { fontFamily: FONT.ui, fontSize: '20px', color: HEX.brass })
      .setOrigin(0, 0.5);

    this.buildPunchCard(134);
    this.buildWheel(width / 2, 800);

    if (this.toastMsg) this.showToast(this.toastMsg);
  }

  // ---------- stamp card ----------

  private buildPunchCard(y: number): void {
    const { width } = this.scale;
    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 300, COLORS.parchmentLight, COLORS.saddle);
    // ticket stub perforation - a dashed ink line inside the top edge
    g.fillStyle(COLORS.ink, 0.35);
    for (let px = 56; px < width - 64; px += 18) g.fillRect(px, y + 58, 9, 2);

    this.add.text(64, y + 18, 'STAMP CARD', { fontFamily: FONT.display, fontSize: '26px', color: HEX.ink });
    const d = gameState.data.daily;
    this.add
      .text(width - 64, y + 26, `STREAK ${d.punchStreak}`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
      .setOrigin(1, 0.5);

    const punched = d.punchStreak === 0 ? 0 : ((d.punchStreak - 1) % 7) + 1;
    for (let i = 0; i < 7; i++) {
      const cx = 108 + i * 88;
      const cy = y + 150;
      this.add
        .text(cx, cy - 58, `${PUNCH_REWARDS[i]}`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.brass })
        .setOrigin(0.5);
      g.fillStyle(COLORS.ink);
      g.fillRect(cx - 34, cy - 34, 68, 68);
      if (i < punched) {
        // punched through - dark hole with a stamped star
        g.fillStyle(COLORS.saddleDark);
        g.fillRect(cx - 30, cy - 30, 60, 60);
        this.add.image(cx, cy, 'icon-star').setTint(COLORS.parchment).setScale(0.85);
      } else {
        g.fillStyle(COLORS.parchment);
        g.fillRect(cx - 30, cy - 30, 60, 60);
      }
      this.add
        .text(cx, cy + 52, `DAY ${i + 1}`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
        .setOrigin(0.5);
    }

    if (d.lastPunch !== dateKey()) {
      makeButton(this, width / 2, y + 340, 300, 62, 'PUNCH IT', () => this.punch(), '20px');
    } else {
      this.add
        .text(width / 2, y + 340, 'PUNCHED - NEW STAMP AT SUNUP', {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.sage
        })
        .setOrigin(0.5);
    }
  }

  private punch(): void {
    const d = gameState.data.daily;
    const today = dateKey();
    if (d.lastPunch === today) return;
    const yesterday = dateKey(new Date(Date.now() - 86400000));
    d.punchStreak = d.lastPunch === yesterday ? d.punchStreak + 1 : 1;
    d.lastPunch = today;
    const reward = PUNCH_REWARDS[(d.punchStreak - 1) % 7];
    gameState.data.currency += reward;
    gameState.save();
    this.scene.restart({ toast: `+${reward} DUST` });
  }

  // ---------- fortune wheel ----------

  private buildWheel(cx: number, cy: number): void {
    const { width } = this.scale;
    this.add
      .text(width / 2, cy - WHEEL_R - 76, 'FORTUNE WHEEL', { fontFamily: FONT.display, fontSize: '26px', color: HEX.ink })
      .setOrigin(0.5);

    const g = this.add.graphics();
    const table = this.freeUsed ? AD_WHEEL : FREE_WHEEL;
    const parts: Phaser.GameObjects.GameObject[] = [g];
    // octagonal wagon wheel: 8 straight-edged wedges, saddle rim, ink spokes
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const a0 = a - Math.PI / 8;
      const a1 = a + Math.PI / 8;
      const pts = [
        new Phaser.Geom.Point(0, 0),
        new Phaser.Geom.Point(Math.cos(a0) * WHEEL_R, Math.sin(a0) * WHEEL_R),
        new Phaser.Geom.Point(Math.cos(a1) * WHEEL_R, Math.sin(a1) * WHEEL_R)
      ];
      g.fillStyle(i % 2 === 0 ? COLORS.parchmentLight : COLORS.sand);
      g.fillPoints(pts, true);
      g.lineStyle(4, COLORS.ink, 0.85);
      g.strokePoints(pts, true);
      const label = this.add
        .text(Math.cos(a) * WHEEL_R * 0.62, Math.sin(a) * WHEEL_R * 0.62, `${table[i]}`, {
          fontFamily: FONT.ui,
          fontSize: '22px',
          color: HEX.brass
        })
        .setOrigin(0.5)
        .setRotation(a + Math.PI / 2);
      this.wedgeLabels.push(label);
      parts.push(label);
    }
    // hub
    g.fillStyle(COLORS.saddle);
    g.fillRect(-16, -16, 32, 32);
    g.lineStyle(3, COLORS.ink);
    g.strokeRect(-16, -16, 32, 32);
    this.wheel = this.add.container(cx, cy, parts);

    // fixed pointer above the wheel
    const pg = this.add.graphics();
    pg.fillStyle(COLORS.ink);
    pg.fillTriangle(cx - 14, cy - WHEEL_R - 24, cx + 14, cy - WHEEL_R - 24, cx, cy - WHEEL_R + 2);
    pg.fillStyle(COLORS.saddle);
    pg.fillTriangle(cx - 9, cy - WHEEL_R - 21, cx + 9, cy - WHEEL_R - 21, cx, cy - WHEEL_R - 4);

    const btn = makeButton(this, width / 2, cy + WHEEL_R + 54, 380, 64, '', () => this.trySpin(), '20px');
    this.spinLabel = btn.list[2] as Phaser.GameObjects.Text;
    this.spinLabel.setText(this.freeUsed ? 'WATCH AD + SPIN' : 'SPIN (FREE TODAY)');
    this.add
      .text(width / 2, cy + WHEEL_R + 106, 'AD SPINS PAY SMALLER REWARDS', {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      })
      .setOrigin(0.5);
  }

  private trySpin(): void {
    if (this.spinning) return;
    if (!this.freeUsed) {
      this.freeUsed = true;
      gameState.data.daily.lastSpin = dateKey();
      gameState.save();
      this.spin(FREE_WHEEL);
      return;
    }
    // ad stub: the real rewarded ad plugs in at the M10 Capacitor wrap
    this.spinning = true;
    this.spinLabel.setText('AD PLAYING...');
    this.wedgeLabels.forEach((t, i) => t.setText(`${AD_WHEEL[i]}`));
    this.time.delayedCall(1400, () => {
      this.spinning = false;
      this.spin(AD_WHEEL);
    });
  }

  private spin(table: number[]): void {
    if (this.spinning) return;
    this.spinning = true;
    this.spinLabel.setText('SPINNING...');
    const idx = Phaser.Math.Between(0, 7);
    const rot = this.wheel.rotation;
    // land wedge idx under the top pointer after 4 extra full turns
    const wanted = -((idx * Math.PI) / 4);
    const delta = Phaser.Math.Angle.Normalize(wanted - rot);
    this.tweens.add({
      targets: this.wheel,
      rotation: rot + delta + Math.PI * 8,
      duration: 3200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        const reward = table[idx];
        gameState.data.currency += reward;
        gameState.save();
        this.dustText.setText(`${gameState.data.currency}`);
        this.showToast(`+${reward} DUST`);
        this.spinning = false;
        this.spinLabel.setText('WATCH AD + SPIN');
      }
    });
  }

  private showToast(msg: string): void {
    const { width } = this.scale;
    const toast = this.add
      .text(width / 2, TOP_BAR_H + 4, msg, { fontFamily: FONT.ui, fontSize: '24px', color: HEX.brass })
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.tweens.add({ targets: toast, alpha: 0, delay: 1600, duration: 400, onComplete: () => toast.destroy() });
  }
}
