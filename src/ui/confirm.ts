import Phaser from 'phaser';
import { COLORS, FONT, HEX, drawPixelPanel } from './theme';
import { makeButton } from './button';

/**
 * Flat pixel confirmation dialog for destructive actions (releasing
 * critters, deleting posses). Dim tap or CANCEL dismisses.
 */
export function confirmDialog(
  scene: Phaser.Scene,
  title: string,
  body: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  const { width, height } = scene.scale;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const close = () => objs.forEach((o) => o.destroy());

  const dim = scene.add
    .rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.65)
    .setDepth(80)
    .setInteractive();
  dim.on('pointerup', close);
  objs.push(dim);

  const g = scene.add.graphics().setDepth(81);
  drawPixelPanel(g, width / 2 - 280, height / 2 - 170, 560, 340, COLORS.parchment, COLORS.saddle);
  objs.push(g);

  objs.push(
    scene.add
      .text(width / 2, height / 2 - 110, title, {
        fontFamily: FONT.display,
        fontSize: '30px',
        color: HEX.ink
      })
      .setOrigin(0.5)
      .setDepth(82)
  );
  objs.push(
    scene.add
      .text(width / 2, height / 2 - 30, body, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.saddle,
        align: 'center',
        wordWrap: { width: 480 }
      })
      .setOrigin(0.5)
      .setDepth(82)
  );

  objs.push(
    makeButton(scene, width / 2 - 120, height / 2 + 90, 200, 62, 'CANCEL', close, '18px').setDepth(82)
  );
  objs.push(
    makeButton(
      scene,
      width / 2 + 120,
      height / 2 + 90,
      200,
      62,
      confirmLabel,
      () => {
        close();
        onConfirm();
      },
      '18px',
      COLORS.saddleDark
    ).setDepth(82)
  );
}
