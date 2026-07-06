import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { COLORS, FONT, HEX } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { buildNav, NAV_HEIGHT } from '../ui/nav';
import { dateKey, msUntilMidnight, seededRng } from '../util/daily';

const BASE_REWARDS = [120, 160, 200];

/**
 * The bounty board: daily quests as wanted posters pinned to a wooden
 * board. Posters are seeded from the date, so they're identical across tab
 * switches, restarts, and devices - and roll over at local midnight. One
 * poster per day is the MOST WANTED (red, double reward). The quest logic
 * itself arrives later; this is the live board.
 */
export class BountiesScene extends Phaser.Scene {
  private countdown!: Phaser.GameObjects.Text;

  constructor() {
    super('Bounties');
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    this.add
      .text(width / 2, 64, 'BOUNTY BOARD', {
        fontFamily: FONT.display,
        fontSize: '44px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    // the wooden board
    const boardX = 36;
    const boardY = 120;
    const boardW = width - 72;
    const boardH = height - NAV_HEIGHT - 220;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink);
    g.fillRect(boardX - 3, boardY - 3, boardW + 6, boardH + 6);
    g.fillStyle(COLORS.saddle);
    g.fillRect(boardX, boardY, boardW, boardH);
    g.fillStyle(COLORS.saddleDark);
    for (let py = boardY + 46; py < boardY + boardH; py += 92) {
      g.fillRect(boardX, py, boardW, 3);
    }

    // today's posters - deterministic from the date
    const rng = seededRng(`bounty-${dateKey()}`);
    const order = [...SPECIES];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const picks = order.slice(0, 3);
    const mostWantedIdx = Math.floor(rng() * picks.length);

    const posterW = 176;
    const gap = (boardW - posterW * 3) / 4;
    picks.forEach((sp, i) => {
      const most = i === mostWantedIdx;
      const px = boardX + gap + i * (posterW + gap);
      const py = boardY + 60 + (i % 2) * 34;
      this.drawPoster(px, py, posterW, 250, sp, most, BASE_REWARDS[i] * (most ? 2 : 1));
    });

    this.countdown = this.add
      .text(width / 2, boardY + boardH + 44, '', {
        fontFamily: FONT.ui,
        fontSize: '17px',
        color: HEX.sage
      })
      .setOrigin(0.5);
    this.updateCountdown();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updateCountdown() });

    buildNav(this, 'bounties');
  }

  private updateCountdown(): void {
    const total = Math.floor(msUntilMidnight() / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    this.countdown.setText(`NEW BOUNTIES IN ${pad(h)}:${pad(m)}:${pad(s)}`);
  }

  private drawPoster(
    x: number,
    y: number,
    w: number,
    h: number,
    sp: SpeciesDef,
    mostWanted: boolean,
    reward: number
  ): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(COLORS.parchment);
    g.fillRect(x, y, w, h);
    if (mostWanted) {
      g.lineStyle(3, COLORS.wantedRed);
      g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    }
    // nail
    g.fillStyle(COLORS.ink);
    g.fillRect(x + w / 2 - 3, y + 6, 6, 6);

    this.add
      .text(x + w / 2, y + 34, mostWanted ? 'MOST\nWANTED' : 'WANTED', {
        fontFamily: FONT.display,
        fontSize: mostWanted ? '21px' : '26px',
        color: mostWanted ? HEX.wantedRed : HEX.ink,
        align: 'center'
      })
      .setOrigin(0.5);

    const key = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    // silhouette: unidentified until the bounty system goes live
    this.add.image(x + w / 2, y + 122, key).setTintFill(COLORS.ink).setAlpha(0.85);

    this.add
      .text(x + w / 2, y + 188, sp.name.toUpperCase(), {
        fontFamily: FONT.ui,
        fontSize: '13px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    this.add.image(x + w / 2 - 38, y + 222, 'icon-coin').setTint(COLORS.brass).setScale(0.6);
    this.add
      .text(x + w / 2 - 16, y + 222, `${reward}`, {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.brass
      })
      .setOrigin(0, 0.5);
  }
}
