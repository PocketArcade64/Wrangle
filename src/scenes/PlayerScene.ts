import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { buildNav } from '../ui/nav';

/** Player profile placeholder - stats fill in as the systems come online. */
export class PlayerScene extends Phaser.Scene {
  constructor() {
    super('Player');
  }

  create(): void {
    ensureIcons(this);
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    this.add
      .text(width / 2, 64, 'THE DRIFTER', {
        fontFamily: FONT.display,
        fontSize: '44px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    // portrait
    const g = this.add.graphics();
    drawPixelPanel(g, width / 2 - 70, 130, 140, 140, COLORS.parchmentLight, COLORS.saddle);
    this.add.image(width / 2, 200, 'icon-hat').setTint(COLORS.saddle).setScale(2);

    this.add
      .text(width / 2, 310, 'A stranger from another range.', {
        fontFamily: FONT.ui,
        fontSize: '15px',
        color: HEX.sage
      })
      .setOrigin(0.5);

    const rows: [string, string, string][] = [
      ['CRITTERS WRANGLED', '0', HEX.ink],
      ['BOUNTIES CLEARED', '0', HEX.ink],
      ['DUST', `${gameState.data.currency}`, HEX.brass]
    ];
    rows.forEach(([label, value, color], i) => {
      const ry = 380 + i * 74;
      const rg = this.add.graphics();
      drawPixelPanel(rg, 60, ry, width - 120, 58, COLORS.parchmentLight, COLORS.saddle, 4);
      this.add
        .text(84, ry + 29, label, { fontFamily: FONT.ui, fontSize: '17px', color: HEX.saddle })
        .setOrigin(0, 0.5);
      this.add
        .text(width - 84, ry + 29, value, { fontFamily: FONT.ui, fontSize: '19px', color })
        .setOrigin(1, 0.5);
    });

    // gear
    const lassoY = 380 + rows.length * 74 + 40;
    makeButton(this, width / 2, lassoY, 300, 64, 'UPGRADE LASSO', () =>
      this.scene.start('Lasso')
    );

    buildNav(this, 'player');
  }
}
