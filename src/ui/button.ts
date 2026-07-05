import Phaser from 'phaser';

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  fontSize = '20px'
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, height, 0x5a3a22).setStrokeStyle(3, 0xf4a340);
  const txt = scene.add
    .text(0, 0, label, { fontFamily: 'Silkscreen', fontSize, color: '#ffe9c9' })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, txt]);
  bg.setInteractive({ useHandCursor: true })
    .on('pointerdown', () => container.setScale(0.95))
    .on('pointerout', () => container.setScale(1))
    .on('pointerup', () => {
      container.setScale(1);
      onClick();
    });
  return container;
}
