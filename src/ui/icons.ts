import Phaser from 'phaser';

/**
 * Custom pixel-art UI glyphs, defined as bitmaps and generated as white
 * textures (tint at point of use). 11x11 grid, 4px per cell = 44px icons.
 * Flat single-color, square pixels - no anti-aliasing, no rounding.
 */
const PIXEL = 4;

const ICONS: Record<string, string[]> = {
  'icon-home': [
    '.....X.....',
    '....XXX....',
    '...XXXXX...',
    '..XXXXXXX..',
    '.XXXXXXXXX.',
    'XXXXXXXXXXX',
    '.XX.....XX.',
    '.XX..X..XX.',
    '.XX.XXX.XX.',
    '.XX.XXX.XX.',
    '.XXXXXXXXX.'
  ],
  'icon-star': [
    '.....X.....',
    '....XXX....',
    '....XXX....',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..XXXXXXX..',
    '...XXXXX...',
    '...XXXXX...',
    '..XXX.XXX..',
    '.XXX...XXX.',
    '.XX.....XX.'
  ],
  'icon-gavel': [
    '..XXXXXXX..',
    '..XXXXXXX..',
    '..XXXXXXX..',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    '....XXX....',
    '....XXX....',
    '....XXX....',
    '....XXX....',
    '..XXXXXXX..',
    '.XXXXXXXXX.'
  ],
  'icon-crate': [
    'XXXXXXXXXXX',
    'X.........X',
    'X.XX.X.XX.X',
    'X.........X',
    'XXXXXXXXXXX',
    'X.........X',
    'X..X...X..X',
    'X..XX.XX..X',
    'X..X...X..X',
    'X.........X',
    'XXXXXXXXXXX'
  ],
  'icon-hat': [
    '...........',
    '...XXXXX...',
    '...XXXXX...',
    '...XXXXX...',
    '...XXXXX...',
    '..XXXXXXX..',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '...........',
    '...........'
  ],
  'icon-satchel': [
    '....XXX....',
    '...XX.XX...',
    '..XX...XX..',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    'XXXX...XXXX',
    'XXXX.X.XXXX',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.'
  ],
  'icon-coin': [
    '...XXXXX...',
    '..XXXXXXX..',
    '.XXX...XXX.',
    '.XX..X..XX.',
    '.XX..X..XX.',
    '.XX..X..XX.',
    '.XX..X..XX.',
    '.XX..X..XX.',
    '.XXX...XXX.',
    '..XXXXXXX..',
    '...XXXXX...'
  ]
};

export function ensureIcons(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(ICONS)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.add.graphics();
    g.fillStyle(0xffffff);
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === 'X') g.fillRect(rx * PIXEL, ry * PIXEL, PIXEL, PIXEL);
      }
    });
    g.generateTexture(key, rows[0].length * PIXEL, rows.length * PIXEL);
    g.destroy();
  }
}
