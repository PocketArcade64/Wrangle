import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { gameState } from '../state/GameState';
import { COLORS, FONT, HEX, drawPixelPanel } from './theme';

/**
 * Modal picker for a posse slot: unique herd species plus CLEAR (remove
 * from the slot). Shared by the Posses tab and the home carousel.
 * Returns false (and shows nothing) when the herd is empty so the caller
 * can surface its own message.
 */
export function openPossePicker(scene: Phaser.Scene, ti: number, si: number, onDone: () => void): boolean {
  const { width, height } = scene.scale;
  const unique = [...new Set(gameState.data.herd.map((c) => c.speciesId))];
  if (unique.length === 0) return false;

  const modal: Phaser.GameObjects.GameObject[] = [];
  const dim = scene.add
    .rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6)
    .setDepth(60)
    .setInteractive();
  modal.push(dim);
  const g = scene.add.graphics().setDepth(61);
  drawPixelPanel(g, 50, 190, width - 100, 700, COLORS.parchment, COLORS.saddle);
  modal.push(g);
  modal.push(
    scene.add
      .text(width / 2, 236, 'PICK A CRITTER', { fontFamily: FONT.display, fontSize: '28px', color: HEX.ink })
      .setOrigin(0.5)
      .setDepth(62)
  );

  const pick = (id: string | null) => {
    gameState.data.teams[ti].members[si] = id;
    gameState.save();
    modal.forEach((o) => o.destroy());
    onDone();
  };

  const options: (string | null)[] = [null, ...unique.slice(0, 15)];
  options.forEach((id, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 130 + col * 154;
    const y = 330 + row * 156;
    const cell = scene.add
      .rectangle(x, y, 136, 136, COLORS.parchmentLight)
      .setStrokeStyle(3, COLORS.saddle)
      .setDepth(62)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => pick(id));
    modal.push(cell);
    if (id) {
      const sp = SPECIES.find((s) => s.id === id);
      const texKey = sp && scene.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
      modal.push(scene.add.image(x, y - 14, texKey).setDisplaySize(84, 84).setDepth(63));
      modal.push(
        scene.add
          .text(x, y + 46, sp ? sp.name : id, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.ink })
          .setOrigin(0.5)
          .setDepth(63)
      );
    } else {
      modal.push(
        scene.add
          .text(x, y, 'CLEAR', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
          .setOrigin(0.5)
          .setDepth(63)
      );
    }
  });

  dim.on('pointerup', () => modal.forEach((o) => o.destroy()));
  return true;
}
