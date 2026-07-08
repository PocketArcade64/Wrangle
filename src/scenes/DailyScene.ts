import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { dateKey, msUntilMidnight } from '../util/daily';
import { sfx } from '../audio/audio';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { addGoldCounter } from '../ui/goldCounter';
import { makeButton } from '../ui/button';

const TOP_BAR_H = 110;
/** Day 1..7 punch rewards; day 8 starts the card over. */
const PUNCH_REWARDS = [25, 50, 75, 100, 125, 150, 250];
/** Free daily spin wedges (Gold). */
const FREE_WHEEL = [50, 20, 100, 30, 250, 20, 75, 40];
/** Ad-spin wedges - endless but stingier. */
const AD_WHEEL = [10, 5, 25, 5, 50, 10, 15, 5];
const WHEEL_R = 180;
/** Alternate wood tone for the wheel wedges (between saddle and saddleDark). */
const WOOD_ALT = 0x684021;

/**
 * Daily bonus: a rail-ticket STAMP CARD (7-day streak, hole-punched each
 * visit) and a FORTUNE WHEEL - a dark wooden wagon wheel, spun free once a
 * day; watching an ad (stubbed until the real SDK lands at the M10 wrap)
 * buys extra spins on a lesser reward table.
 */
export class DailyScene extends Phaser.Scene {
  private toastMsg?: string;
  private goldText!: Phaser.GameObjects.Text;
  private wheel!: Phaser.GameObjects.Container;
  private wedgeLabels: Phaser.GameObjects.Text[] = [];
  private spinLabel!: Phaser.GameObjects.Text;
  private countdown!: Phaser.GameObjects.Text;
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

    // top bar - title dead center, GOLD matching the home screen corner
    const bar = this.add.graphics();
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => this.scene.start('Home'), '18px');
    this.add
      .text(width / 2, 55, 'DAILY BONUS', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
      .setOrigin(0.5);
    this.goldText = addGoldCounter(this, 55);

    this.buildPunchCard(134);
    this.buildWheel(width / 2, 806);

    // free-spin countdown line, refreshed twice a second
    this.countdown = this.add
      .text(width / 2, 806 + WHEEL_R + 126, '', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
      .setOrigin(0.5);
    this.updateCountdown();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updateCountdown() });
    this.add
      .text(width / 2, 806 + WHEEL_R + 160, 'AD SPINS PAY SMALLER REWARDS', {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      })
      .setOrigin(0.5);

    if (this.toastMsg) this.showToast(this.toastMsg);
  }

  private updateCountdown(): void {
    if (gameState.data.daily.lastSpin === dateKey()) {
      const s = Math.floor(msUntilMidnight() / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      this.countdown.setText(
        `NEXT FREE SPIN IN ${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
      );
    } else {
      this.countdown.setText('FREE SPIN READY');
    }
  }

  // ---------- stamp card ----------

  private buildPunchCard(y: number): void {
    const { width } = this.scale;
    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 300, COLORS.parchmentLight, COLORS.saddle);
    // ticket styling: dashed perforation border all the way around, plus
    // clipped-corner accents like a rail pass
    g.fillStyle(COLORS.ink, 0.35);
    for (let px = 60; px < width - 72; px += 18) {
      g.fillRect(px, y + 14, 9, 2);
      g.fillRect(px, y + 284, 9, 2);
    }
    for (let py = y + 24; py < y + 280; py += 18) {
      g.fillRect(54, py, 2, 9);
      g.fillRect(width - 56, py, 2, 9);
    }
    g.fillStyle(COLORS.saddleDark);
    g.fillRect(46, y + 6, 12, 12);
    g.fillRect(width - 58, y + 6, 12, 12);
    g.fillRect(46, y + 282, 12, 12);
    g.fillRect(width - 58, y + 282, 12, 12);

    this.add
      .text(width / 2, y + 40, 'STAMP CARD', { fontFamily: FONT.display, fontSize: '26px', color: HEX.ink })
      .setOrigin(0.5);
    const d = gameState.data.daily;
    this.add
      .text(width / 2, y + 70, `ONE PUNCH PER SUNRISE - STREAK ${d.punchStreak}`, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      })
      .setOrigin(0.5);

    const punched = d.punchStreak === 0 ? 0 : ((d.punchStreak - 1) % 7) + 1;
    for (let i = 0; i < 7; i++) {
      const cx = width / 2 + (i - 3) * 88;
      const cy = y + 168;
      this.add
        .text(cx, cy - 54, `${PUNCH_REWARDS[i]}`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.brass })
        .setOrigin(0.5);
      g.fillStyle(COLORS.ink);
      g.fillRect(cx - 32, cy - 32, 64, 64);
      if (i < punched) {
        // punched through - dark hole with a stamped star
        g.fillStyle(COLORS.saddleDark);
        g.fillRect(cx - 28, cy - 28, 56, 56);
        this.add.image(cx, cy, 'icon-star').setTint(COLORS.parchment).setScale(0.8);
      } else {
        g.fillStyle(COLORS.parchment);
        g.fillRect(cx - 28, cy - 28, 56, 56);
      }
      this.add
        .text(cx, cy + 50, `DAY ${i + 1}`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
        .setOrigin(0.5);
    }

    if (d.lastPunch !== dateKey()) {
      makeButton(this, width / 2, y + 344, 300, 62, 'PUNCH IT', () => this.punch(), '20px');
    } else {
      this.add
        .text(width / 2, y + 344, 'PUNCHED - NEW STAMP AT SUNUP', {
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
    sfx('punch');
    this.scene.restart({ toast: `+${reward} GOLD` });
  }

  // ---------- fortune wheel ----------

  private buildWheel(cx: number, cy: number): void {
    const { width } = this.scale;
    this.add
      .text(width / 2, cy - WHEEL_R - 88, 'FORTUNE WHEEL', { fontFamily: FONT.display, fontSize: '26px', color: HEX.ink })
      .setOrigin(0.5);

    const g = this.add.graphics();
    const table = this.freeUsed ? AD_WHEEL : FREE_WHEEL;
    const parts: Phaser.GameObjects.GameObject[] = [g];
    // dark wooden wagon wheel: saddle-dark rim, alternating wood-tone
    // wedges, ink spokes, iron studs at each boundary, square iron hub
    g.fillStyle(COLORS.saddleDark);
    g.fillCircle(0, 0, WHEEL_R + 20);
    g.lineStyle(4, COLORS.ink);
    g.strokeCircle(0, 0, WHEEL_R + 20);
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const a0 = a - Math.PI / 8;
      const a1 = a + Math.PI / 8;
      g.fillStyle(i % 2 === 0 ? COLORS.saddle : WOOD_ALT);
      g.slice(0, 0, WHEEL_R, a0, a1, false);
      g.fillPath();
      const label = this.add
        .text(Math.cos(a) * WHEEL_R * 0.66, Math.sin(a) * WHEEL_R * 0.66, `${table[i]}`, {
          fontFamily: FONT.ui,
          fontSize: '22px',
          color: HEX.parchment
        })
        .setOrigin(0.5)
        .setRotation(a + Math.PI / 2);
      this.wedgeLabels.push(label);
      parts.push(label);
    }
    g.lineStyle(3, COLORS.ink, 0.7);
    for (let i = 0; i < 8; i++) {
      const b = -Math.PI / 2 - Math.PI / 8 + (i * Math.PI) / 4;
      g.lineBetween(0, 0, Math.cos(b) * WHEEL_R, Math.sin(b) * WHEEL_R);
      g.fillStyle(COLORS.ink);
      g.fillRect(Math.cos(b) * (WHEEL_R + 10) - 4, Math.sin(b) * (WHEEL_R + 10) - 4, 8, 8);
    }
    g.fillStyle(COLORS.saddle);
    g.fillCircle(0, 0, 30);
    g.lineStyle(3, COLORS.ink);
    g.strokeCircle(0, 0, 30);
    g.fillStyle(COLORS.ink);
    g.fillRect(-8, -8, 16, 16);
    this.wheel = this.add.container(cx, cy, parts);

    // fixed pointer above the wheel
    const pg = this.add.graphics();
    pg.fillStyle(COLORS.ink);
    pg.fillTriangle(cx - 14, cy - WHEEL_R - 40, cx + 14, cy - WHEEL_R - 40, cx, cy - WHEEL_R - 8);
    pg.fillStyle(COLORS.saddle);
    pg.fillTriangle(cx - 9, cy - WHEEL_R - 37, cx + 9, cy - WHEEL_R - 37, cx, cy - WHEEL_R - 14);

    const btn = makeButton(this, width / 2, cy + WHEEL_R + 80, 380, 64, '', () => this.trySpin(), '20px');
    this.spinLabel = btn.list[2] as Phaser.GameObjects.Text;
    this.spinLabel.setText(this.freeUsed ? 'WATCH AD + SPIN' : 'SPIN (FREE TODAY)');
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
        sfx('coin');
        this.goldText.setText(`${gameState.data.currency}`);
        this.showToast(`+${reward} GOLD`);
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
