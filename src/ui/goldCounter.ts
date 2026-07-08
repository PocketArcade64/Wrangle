import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { COLORS, FONT, HEX } from './theme';

/**
 * GOLD readout for a screen's top-right corner: number sized to match the
 * coin glyph, right-aligned against the coin at the edge. Returns the text
 * object so scenes that pay out (daily wheel) can refresh it.
 */
export function addGoldCounter(scene: Phaser.Scene, cy: number): Phaser.GameObjects.Text {
  const { width } = scene.scale;
  scene.add.image(width - 52, cy, 'icon-coin').setTint(COLORS.brass);
  return scene.add
    .text(width - 82, cy, `${gameState.data.currency}`, {
      fontFamily: FONT.ui,
      fontSize: '32px',
      color: HEX.brass
    })
    .setOrigin(1, 0.5);
}
