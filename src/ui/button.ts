import Phaser from 'phaser';
import { sfx } from '../audio/audio';
import { COLORS, FONT, HEX } from './theme';

/**
 * Flat pixel button: hard-offset ink shadow gives depth without gradients;
 * pressing shifts the face down onto the shadow. Square corners only.
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  fontSize = '20px',
  bg: number = COLORS.saddle,
  fg: string = HEX.parchment
): Phaser.GameObjects.Container {
  const shadow = scene.add.rectangle(0, 4, width, height, COLORS.ink);
  const face = scene.add.rectangle(0, 0, width, height, bg).setStrokeStyle(2, COLORS.ink);
  const txt = scene.add
    .text(0, 0, label, { fontFamily: FONT.ui, fontSize, color: fg })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [shadow, face, txt]);

  const press = (down: boolean) => {
    face.y = down ? 3 : 0;
    txt.y = down ? 3 : 0;
  };
  face
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => press(true))
    .on('pointerout', () => press(false))
    .on('pointerup', () => {
      press(false);
      sfx('ui');
      onClick();
    });
  return container;
}
