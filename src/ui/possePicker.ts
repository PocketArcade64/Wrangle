import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { CritterInstance, gameState } from '../state/GameState';
import { COLORS, FONT, HEX, drawPixelPanel } from './theme';

/**
 * Modal picker for a posse slot. Stays open until the X (top right) is
 * pressed or a pick is made - stray taps on the dim do NOT dismiss it.
 * Slots hold individual critters (uids): two of the same SPECIES may ride
 * together, but a critter already in ANY posse slot is excluded, so the
 * same animal can't fill two slots. CLEAR empties the slot. Returns false
 * (shows nothing) when the herd is empty.
 */
export function openPossePicker(scene: Phaser.Scene, ti: number, si: number, onDone: () => void): boolean {
  const { width, height } = scene.scale;
  const herd = gameState.data.herd;
  if (herd.length === 0) return false;

  // critters already riding in any posse (including this slot's occupant)
  const used = new Set<string>();
  for (const team of gameState.data.teams) {
    for (const m of team.members) if (m) used.add(m);
  }
  const available = herd.filter((c) => !used.has(c.uid));

  const modal: Phaser.GameObjects.GameObject[] = [];
  const close = () => modal.forEach((o) => o.destroy());

  const dim = scene.add
    .rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6)
    .setDepth(60)
    .setInteractive(); // swallows taps; only the X closes
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
  const closeBtn = scene.add
    .image(width - 96, 236, 'icon-x')
    .setTint(COLORS.saddle)
    .setDepth(62)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', close);
  modal.push(closeBtn);

  const pick = (uid: string | null) => {
    gameState.data.teams[ti].members[si] = uid;
    gameState.save();
    close();
    onDone();
  };

  const options: (CritterInstance | null)[] = [null, ...available.slice(0, 15)];
  options.forEach((inst, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 130 + col * 154;
    const y = 330 + row * 156;
    const cell = scene.add
      .rectangle(x, y, 136, 136, COLORS.parchmentLight)
      .setStrokeStyle(3, COLORS.saddle)
      .setDepth(62)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => pick(inst ? inst.uid : null));
    modal.push(cell);
    if (inst) {
      const sp = SPECIES.find((s) => s.id === inst.speciesId);
      const texKey = sp && scene.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
      modal.push(scene.add.image(x, y - 20, texKey).setDisplaySize(76, 76).setDepth(63));
      modal.push(
        scene.add
          .text(x, y + 34, sp ? sp.name : inst.speciesId, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.ink })
          .setOrigin(0.5)
          .setDepth(63)
      );
      modal.push(
        scene.add
          .text(x, y + 54, `LV ${inst.level}`, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle })
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

  if (available.length === 0) {
    modal.push(
      scene.add
        .text(width / 2, 560, 'EVERY CRITTER YOU OWN IS ALREADY\nRIDING WITH A POSSE', {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.sage,
          align: 'center'
        })
        .setOrigin(0.5)
        .setDepth(63)
    );
  }

  return true;
}
