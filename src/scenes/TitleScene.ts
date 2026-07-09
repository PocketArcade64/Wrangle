import Phaser from 'phaser';
import { playMusic } from '../audio/audio';
import { COLORS, FONT, HEX } from '../ui/theme';
import {
  drawFrontierBackdrop,
  drawFrontierForeground,
  drawSky,
  seenSpecies,
  skyLook,
  WalkerTroupe
} from '../ui/vignette';

/**
 * The title screen is a living frontier vista: the sky, sun/moon and light
 * match the player's REAL local time (dawn, day, dusk, dark-moon night),
 * and random critters they've SEEN wander the flats on two depth lanes.
 * The logo rides full-width above it all.
 */
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

    // the vista - sky first, then skyline + ground, then walker lanes
    const look = skyLook();
    const horizonY = Math.round(height * 0.6);
    const sky = this.add.graphics();
    drawSky(sky, 0, 0, width, horizonY, look);
    drawFrontierBackdrop(sky, 0, width, horizonY, height, look);
    const backLayer = this.add.container(0, 0);
    const midG = this.add.graphics();
    drawFrontierForeground(midG, 0, width, horizonY, height, look);
    const frontLayer = this.add.container(0, 0);

    // random critters the player has seen, out for a stroll
    const pool = seenSpecies();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    new WalkerTroupe(this, pool.slice(0, 3), {
      left: 0,
      right: width,
      frontY: height - 120,
      backY: horizonY + 44,
      frontSize: 96,
      backSize: 60,
      frontLayer,
      backLayer
    });

    // the hand-made logo, full width: 216x107 at x3 integer scale = 648px
    // wide with 36px of sky either side, over a hard pixel drop shadow
    const logoCy = 300;
    if (this.textures.exists('title-logo')) {
      this.add.image(width / 2 + 6, logoCy + 6, 'title-logo').setScale(3).setTintFill(COLORS.ink).setAlpha(0.3);
      this.add.image(width / 2, logoCy, 'title-logo').setScale(3);
    } else {
      this.add
        .text(width / 2, logoCy, 'WRANGLE', {
          fontFamily: FONT.display,
          fontSize: '92px',
          color: look.darkText ? HEX.ink : HEX.parchment
        })
        .setOrigin(0.5)
        .setLetterSpacing(4);
    }

    // single clay accent under the brand
    this.add.rectangle(width / 2, logoCy + 186, 250, 8, COLORS.clay);
    this.add
      .text(width / 2, logoCy + 224, "a frontier lasso-'em-up", {
        fontFamily: FONT.ui,
        fontSize: '20px',
        color: look.darkText ? HEX.saddle : HEX.parchment
      })
      .setOrigin(0.5);

    const tap = this.add
      .text(width / 2, height * 0.74, 'TAP TO START', {
        fontFamily: FONT.ui,
        fontSize: '24px',
        color: look.darkText ? HEX.ink : HEX.parchmentLight
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: tap,
      alpha: 0.25,
      duration: 650,
      yoyo: true,
      repeat: -1
    });

    // start on pointerUP: switching on pointerdown let the same tap's
    // release land on freshly-created Home buttons (double-press bug)
    this.input.once('pointerup', () => this.scene.start('Home'));
  }
}
