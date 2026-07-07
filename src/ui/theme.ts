import type Phaser from 'phaser';

/**
 * Wrangle design tokens - sun-worn, screen-printed-poster palette.
 *
 * Restraint rules (enforced by convention, documented in GAME_DESIGN.md):
 * - clay is the ONLY loud color: Explore CTA + active nav tab, nothing else
 * - brass is reserved for currency so it stays meaningful
 * - no gradients, no glow, no rounded corners - flat fills, square pixels
 */
export const COLORS = {
  parchment: 0xe8d9b5,
  parchmentLight: 0xf0e2c2,
  parchmentDark: 0xdcc9a2,
  saddle: 0x7a4a2b,
  saddleDark: 0x5c3720,
  clay: 0xc1652f,
  clayDark: 0x9a4e22,
  sage: 0x7c8b6f,
  denim: 0x3f5c6c,
  ink: 0x2b221a,
  brass: 0xb8912a,
  sand: 0xd9bd8d,
  /** In-world print red for MOST WANTED posters only - never UI urgency. */
  wantedRed: 0xa2261a
};

export const HEX = {
  parchment: '#e8d9b5',
  parchmentLight: '#f0e2c2',
  parchmentDark: '#dcc9a2',
  saddle: '#7a4a2b',
  saddleDark: '#5c3720',
  clay: '#c1652f',
  clayDark: '#9a4e22',
  sage: '#7c8b6f',
  denim: '#3f5c6c',
  ink: '#2b221a',
  brass: '#b8912a',
  wantedRed: '#a2261a'
};

/**
 * Sizing: the logical canvas is 720px wide vs ~393pt on an iPhone, so
 * 1 logical px ~ 0.55pt. Apple HIG floor is ~11pt => NEVER go below
 * ~20 logical px for text the player must read; 16px only for tertiary
 * labels; body text 22-26px.
 */
export const FONT = {
  /**
   * Display: chunky branding-iron feel for headers/logo. Pixelify Sans is
   * the stand-in until the custom bitmap face is drawn (art pass, M7).
   */
  display: '"Pixelify Sans"',
  /** UI/body: tight pixel-grid sans, legible small. */
  ui: 'Silkscreen'
};

/**
 * Flat pixel panel: ink outline, structural border, inner fill.
 * Square corners only.
 */
export function drawPixelPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = COLORS.parchment,
  border: number = COLORS.saddle,
  borderW = 6
): void {
  g.fillStyle(COLORS.ink);
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(border);
  g.fillRect(x, y, w, h);
  g.fillStyle(fill);
  g.fillRect(x + borderW, y + borderW, w - borderW * 2, h - borderW * 2);
}
