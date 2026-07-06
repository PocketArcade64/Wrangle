import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { COLORS, FONT, HEX } from '../ui/theme';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

const TOP_BAR_H = 110;
const COLS = 3;
const CELL_W = 226;
const CELL_H = 250;
const TAP_SLOP = 12; // px of drag allowed before a release stops counting as a tap

/**
 * The Critter Dex: scrollable grid in creatures.csv row order. Doubles as
 * the Explore target-picker until the map (M4) exists. Drag to scroll,
 * tap a cell to start a capture attempt.
 */
export class CaptureSelectScene extends Phaser.Scene {
  private listContainer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private minScroll = 0;
  private dragging = false;
  private dragStartY = 0;
  private scrollStart = 0;
  private dragDist = 0;

  constructor() {
    super('CaptureSelect');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.scrollY = 0;
    this.dragging = false;
    this.dragDist = 0;

    this.listContainer = this.add.container(0, 0);

    const startX = (width - COLS * CELL_W) / 2 + CELL_W / 2;
    const startY = TOP_BAR_H + 30 + CELL_H / 2;
    SPECIES.forEach((sp, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      this.makeCell(sp, i, startX + col * CELL_W, startY + row * CELL_H);
    });

    const rowCount = Math.ceil(SPECIES.length / COLS);
    const contentBottom = TOP_BAR_H + 30 + rowCount * CELL_H + 30;
    this.minScroll = Math.min(0, height - NAV_HEIGHT - contentBottom);

    // fixed top bar (drawn above the scrolling list)
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);
    this.add
      .text(30, TOP_BAR_H / 2, 'CRITTER DEX', {
        fontFamily: FONT.display,
        fontSize: '34px',
        color: HEX.ink
      })
      .setOrigin(0, 0.5)
      .setDepth(11);
    this.add
      .text(width - 30, TOP_BAR_H / 2, `${SPECIES.length}`, {
        fontFamily: FONT.ui,
        fontSize: '20px',
        color: HEX.saddle
      })
      .setOrigin(1, 0.5)
      .setDepth(11);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < TOP_BAR_H || p.y > height - NAV_HEIGHT) return;
      this.dragging = true;
      this.dragStartY = p.y;
      this.scrollStart = this.scrollY;
      this.dragDist = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      const dy = p.y - this.dragStartY;
      this.dragDist = Math.max(this.dragDist, Math.abs(dy));
      this.scrollY = Phaser.Math.Clamp(this.scrollStart + dy, this.minScroll, 0);
      this.listContainer.y = this.scrollY;
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
    });

    buildNav(this, 'collection');
  }

  private makeCell(sp: SpeciesDef, index: number, x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, CELL_W - 16, CELL_H - 16, COLORS.parchmentLight)
      .setStrokeStyle(3, COLORS.saddle);
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const img = this.add.image(x, y - 38, texKey).setScale(1.1);
    const num = this.add.text(
      x - (CELL_W - 16) / 2 + 8,
      y - (CELL_H - 16) / 2 + 6,
      `#${String(index + 1).padStart(3, '0')}`,
      { fontFamily: FONT.ui, fontSize: '13px', color: HEX.saddle }
    );
    const name = this.add
      .text(x, y + 42, sp.name, {
        fontFamily: FONT.ui,
        fontSize: '15px',
        color: HEX.ink,
        align: 'center',
        wordWrap: { width: CELL_W - 28 }
      })
      .setOrigin(0.5, 0);
    const typeLabel = [sp.type1, sp.type2].filter(Boolean).join('/');
    const types = this.add
      .text(x, y + (CELL_H - 16) / 2 - 22, typeLabel, {
        fontFamily: FONT.ui,
        fontSize: '12px',
        color: HEX.sage
      })
      .setOrigin(0.5, 0);

    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.dragDist < TAP_SLOP) this.scene.start('Capture', { speciesId: sp.id });
    });

    this.listContainer.add([bg, img, num, name, types]);
  }
}
