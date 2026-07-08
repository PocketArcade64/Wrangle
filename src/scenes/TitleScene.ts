import Phaser from 'phaser';
import { playMusic } from '../audio/audio';
import { FONT, HEX, COLORS } from '../ui/theme';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    // Queue the theme immediately: browsers keep audio suspended until the
    // first tap, so the tracker idles at time zero and the music starts the
    // instant the unlock gesture lands - no dead air on the menus.
    playMusic('home');

    // the hand-made logo (216x107 pixel art, integer-scaled to stay crisp)
    if (this.textures.exists('title-logo')) {
      this.add.image(width / 2, height * 0.3, 'title-logo').setScale(2);
    } else {
      this.add
        .text(width / 2, height * 0.3, 'WRANGLE', {
          fontFamily: FONT.display,
          fontSize: '92px',
          color: HEX.ink
        })
        .setOrigin(0.5)
        .setLetterSpacing(4);
    }

    // single clay accent under the brand
    this.add.rectangle(width / 2, height * 0.3 + 128, 250, 8, COLORS.clay);

    this.add
      .text(width / 2, height * 0.3 + 172, "a frontier lasso-'em-up", {
        fontFamily: FONT.ui,
        fontSize: '20px',
        color: HEX.saddle
      })
      .setOrigin(0.5);

    const tap = this.add
      .text(width / 2, height * 0.62, 'TAP TO START', {
        fontFamily: FONT.ui,
        fontSize: '24px',
        color: HEX.ink
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: tap,
      alpha: 0.25,
      duration: 650,
      yoyo: true,
      repeat: -1
    });

    this.add
      .text(width / 2, height - 40, 'menu shell - m2', {
        fontFamily: FONT.ui,
        fontSize: '13px',
        color: HEX.saddle
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    this.input.once('pointerdown', () => this.scene.start('Home'));
  }
}
