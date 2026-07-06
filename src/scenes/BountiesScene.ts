import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { COLORS, FONT, HEX } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

/**
 * The bounty board: daily quests as wanted posters pinned to a wooden
 * board. Static preview posters for now - the quest system arrives later.
 */
export class BountiesScene extends Phaser.Scene {
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

    // three preview posters
    const picks = Phaser.Utils.Array.Shuffle([...SPECIES]).slice(0, 3);
    const posterW = 176;
    const gap = (boardW - posterW * 3) / 4;
    picks.forEach((sp, i) => {
      const px = boardX + gap + i * (posterW + gap);
      const py = boardY + 60 + (i % 2) * 34;
      this.drawPoster(px, py, posterW, 250, sp.name, sp.textureKey, 120 + i * 40);
    });

    this.add
      .text(width / 2, boardY + boardH + 44, 'DAILY BOUNTIES POST AT SUNUP - SOON', {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.sage
      })
      .setOrigin(0.5);

    buildNav(this, 'bounties');
  }

  private drawPoster(x: number, y: number, w: number, h: number, name: string, texKey: string, reward: number): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(COLORS.parchment);
    g.fillRect(x, y, w, h);
    // nail
    g.fillStyle(COLORS.ink);
    g.fillRect(x + w / 2 - 3, y + 6, 6, 6);

    this.add
      .text(x + w / 2, y + 34, 'WANTED', { fontFamily: FONT.display, fontSize: '26px', color: HEX.ink })
      .setOrigin(0.5);

    const key = this.textures.exists(texKey) ? texKey : 'pl-unknown';
    // silhouette: unidentified until the bounty system goes live
    this.add.image(x + w / 2, y + 118, key).setTintFill(COLORS.ink).setAlpha(0.85);

    this.add
      .text(x + w / 2, y + 186, name.toUpperCase(), {
        fontFamily: FONT.ui,
        fontSize: '13px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    this.add.image(x + w / 2 - 34, y + 222, 'icon-coin').setTint(COLORS.brass).setScale(0.6);
    this.add
      .text(x + w / 2 - 12, y + 222, `${reward}`, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.brass })
      .setOrigin(0, 0.5);
  }
}
