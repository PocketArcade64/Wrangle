import Phaser from 'phaser';
import { TYPE_BADGES } from '../data/typeChart';

/**
 * 19x19 circular type icons ("type dots") - compact move-type markers for
 * posse slots and anywhere the full 46x15 badge is too wide.
 *
 * Hand-authored pixel art, rendered pixel-by-pixel (no antialiased circle
 * calls): ink ring, type-colored fill, and a 9x9 symbol glyph per type.
 * BootScene still tries to load user art first from
 *   public/sprites/types/<Type>_circle_19x19.png   (keyed typedot-<Type>)
 * so dropping real files under those names overrides these automatically.
 */

export const TYPE_DOT_COLORS: Record<string, number> = {
  Air: 0x8fb8d0,
  Bug: 0x9aa83a,
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

/** 9x9 symbol glyphs, drawn centered on the dot. X = lit pixel. */
const SYMBOLS: Record<string, string[]> = {
  Fire: [
    '....X....',
    '...XX....',
    '...XXX...',
    '..XXXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...'
  ],
  Water: [
    '....X....',
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...'
  ],
  Grass: [
    '......XX.',
    '....XXXX.',
    '...XXXXX.',
    '..XXXXX..',
    '..XXXX...',
    '.XXXX....',
    '.XXX.....',
    '..X......',
    '.X.......'
  ],
  Lightning: [
    '....XXX..',
    '...XXX...',
    '..XXX....',
    '.XXXXXX..',
    '...XXX...',
    '..XXX....',
    '.XXX.....',
    '.XX......',
    '.X.......'
  ],
  Air: [
    '.........',
    '.XXXXX...',
    '.....XX..',
    '.........',
    'XXXXXXX..',
    '......XX.',
    '.........',
    '..XXXXX..',
    '.........'
  ],
  Earth: [
    '.........',
    '....X....',
    '...XXX...',
    '...XXX...',
    '..XXXXX..',
    '.XX.XXXX.',
    '.X..XXXX.',
    'XXXXXXXXX',
    '.........'
  ],
  Frost: [
    '....X....',
    '.X..X..X.',
    '..X.X.X..',
    '...XXX...',
    'XXXXXXXXX',
    '...XXX...',
    '..X.X.X..',
    '.X..X..X.',
    '....X....'
  ],
  Dark: [
    '...XXX...',
    '..XXXX...',
    '.XXX.....',
    '.XXX.....',
    '.XXX.....',
    '.XXX.....',
    '.XXX.....',
    '..XXXX...',
    '...XXX...'
  ],
  Psychic: [
    '.........',
    '.........',
    '..XXXXX..',
    '.XX...XX.',
    'XX..X..XX',
    '.XX...XX.',
    '..XXXXX..',
    '.........',
    '.........'
  ],
  Ghost: [
    '...XXX...',
    '..XXXXX..',
    '..X.X.X..',
    '..XXXXX..',
    '..XXXXX..',
    '..XXXXX..',
    '..X.X.X..',
    '.........',
    '.........'
  ],
  Metal: [
    '.........',
    '..XXXXX..',
    '.XXXXXXX.',
    '.XX...XX.',
    '.XX...XX.',
    '.XX...XX.',
    '.XXXXXXX.',
    '..XXXXX..',
    '.........'
  ],
  Mystical: [
    '....X....',
    '....X....',
    '...XXX...',
    '..XXXXX..',
    'XXXXXXXXX',
    '..XXXXX..',
    '...XXX...',
    '....X....',
    '....X....'
  ],
  Normal: [
    '.........',
    '.........',
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '..XXXXX..',
    '...XXX...',
    '.........',
    '.........'
  ],
  Fighting: [
    '.........',
    '.XX.XX.X.',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '..XXXXXX.',
    '..XXXXX..',
    '.........',
    '.........'
  ],
  Poison: [
    '..XX.....',
    '.XXXX....',
    '.XXXX..X.',
    '..XX..XXX',
    '.......X.',
    '...XX....',
    '..XXXX...',
    '..XXXX...',
    '...XX....'
  ],
  Bug: [
    '.X.....X.',
    '..X...X..',
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '..XXXXX..',
    '...XXX...',
    '..X...X..',
    '.........'
  ],
  Dragon: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
    '.........'
  ]
};

const INK = 0x2b221a;
const LIGHT = 0xf6efdd;

export function ensureTypeDots(scene: Phaser.Scene): void {
  for (const t of TYPE_BADGES) {
    const key = `typedot-${t}`;
    if (scene.textures.exists(key)) continue;
    const color = TYPE_DOT_COLORS[t] ?? 0xb8a878;
    // dark symbols on light dots, light symbols on dark dots
    const r = (color >> 16) & 255;
    const g2 = (color >> 8) & 255;
    const b = color & 255;
    const symColor = r * 0.3 + g2 * 0.6 + b * 0.1 > 150 ? INK : LIGHT;

    const g = scene.add.graphics();
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 19; x++) {
        const dx = x - 9;
        const dy = y - 9;
        const r2 = dx * dx + dy * dy;
        if (r2 > 90.25) continue; // outside the 19px disc
        g.fillStyle(r2 > 58 ? INK : color); // outer ring is ink
        g.fillRect(x, y, 1, 1);
      }
    }
    const sym = SYMBOLS[t];
    if (sym) {
      g.fillStyle(symColor);
      for (let sy = 0; sy < sym.length; sy++) {
        for (let sx = 0; sx < sym[sy].length; sx++) {
          if (sym[sy][sx] === 'X') g.fillRect(5 + sx, 5 + sy, 1, 1);
        }
      }
    }
    g.generateTexture(key, 19, 19);
    g.destroy();
  }
}
