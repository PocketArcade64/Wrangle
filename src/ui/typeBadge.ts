import Phaser from 'phaser';
import { badgeName } from '../data/typeChart';
import { FONT, HEX } from './theme';

/**
 * The user's hand-drawn type badge (46x15 px art, integer-scaled), centered
 * at (x, y). Falls back to a plain text tag if the art is missing.
 */
export function addTypeBadge(scene: Phaser.Scene, x: number, y: number, csvType: string, scale = 3): void {
  const key = `type-${badgeName(csvType)}`;
  if (scene.textures.exists(key)) {
    scene.add.image(x, y, key).setScale(scale);
  } else {
    scene.add
      .text(x, y, badgeName(csvType).toUpperCase(), {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.parchment,
        backgroundColor: HEX.saddle,
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5);
  }
}
