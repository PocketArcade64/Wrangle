import Phaser from 'phaser';
import { COLORS, FONT, HEX } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { buildNav } from '../ui/nav';

/** Auction house placeholder - the shared market needs the online backend. */
export class AuctionScene extends Phaser.Scene {
  constructor() {
    super('Auction');
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    this.add
      .text(width / 2, 64, 'AUCTION HOUSE', {
        fontFamily: FONT.display,
        fontSize: '44px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    const cy = height * 0.42;
    // stacked crates
    this.add.image(width / 2 - 40, cy, 'icon-crate').setTint(COLORS.saddle).setScale(3);
    this.add.image(width / 2 + 62, cy + 22, 'icon-crate').setTint(COLORS.saddleDark).setScale(2.2);

    this.add
      .text(width / 2, cy + 130, "THE MARKET WAGON\nHASN'T ARRIVED YET", {
        fontFamily: FONT.ui,
        fontSize: '20px',
        color: HEX.ink,
        align: 'center'
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, cy + 196, 'Player-to-player trading opens\nwith the online update.', {
        fontFamily: FONT.ui,
        fontSize: '14px',
        color: HEX.sage,
        align: 'center'
      })
      .setOrigin(0.5);

    buildNav(this, 'auction');
  }
}
