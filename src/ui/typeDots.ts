import Phaser from 'phaser';
import { TYPE_BADGES } from '../data/typeChart';

/**
 * 19x19 circular type icons ("type dots") - compact move-type markers for
 * posse slots and anywhere the full 46x15 badge is too wide.
 *
 * BootScene first tries to load user art from
 *   public/sprites/types/<Type>_circle_19x19.png   (keyed typedot-<Type>)
 * and ensureTypeDots() generates a placeholder circle (type color, ink
 * ring, highlight glint) for any file that isn't there yet - drop in real
 * art under those exact names and it takes over automatically.
 */

export const TYPE_DOT_COLORS: Record<string, number> = {
  Air: 0x8fb8d0,
  Bug: 0x9aA83a,
  Dark: 0x4a4048,
  Dragon: 0x5a4a9a,
  Earth: 0x9a6a3a,
  Fighting: 0xc06a38,
  Fire: 0xd0642a,
  Frost: 0x8ac4d8,
  Ghost: 0x7a6bb5,
  Grass: 0x5f9a3c,
  Lightning: 0xd8b02a,
  Metal: 0x9a9aa2,
  Mystical: 0xd98aa8,
  Normal: 0xb8a878,
  Poison: 0x8a5aa0,
  Psychic: 0xc060a8,
  Water: 0x4a86b8
};

export function ensureTypeDots(scene: Phaser.Scene): void {
  for (const t of TYPE_BADGES) {
    const key = `typedot-${t}`;
    if (scene.textures.exists(key)) continue;
    const color = TYPE_DOT_COLORS[t] ?? 0xb8a878;
    const g = scene.add.graphics();
    g.fillStyle(0x2b221a);
    g.fillCircle(9.5, 9.5, 9.5);
    g.fillStyle(color);
    g.fillCircle(9.5, 9.5, 7.5);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(5, 4, 4, 3);
    g.generateTexture(key, 19, 19);
    g.destroy();
  }
}
