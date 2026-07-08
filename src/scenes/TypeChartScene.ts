import Phaser from 'phaser';
import { ALL_TYPES, effectiveness } from '../data/typeChart';
import { COLORS, FONT, HEX } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';

const TOP_BAR_H = 110;
const CELL = 32;
const HEADER_W = 96;
const GRID_X = 40;
const GRID_Y = 234;

/** Where BACK should return to (set by whoever opened the chart). */
interface ChartReturn {
  scene: string;
  data?: Record<string, unknown>;
}

/**
 * The full 17-type chart as a square matrix (classic Pokemon layout):
 * rows attack, columns defend. Sage = 2x, adobe red = 1/2x, ink = no
 * effect, blank = normal. Opened from a specific creature its type
 * rows/columns start outlined in denim; tapping any row or column
 * header badge highlights that one type (tap it again to clear).
 */
export class TypeChartScene extends Phaser.Scene {
  private back?: ChartReturn;
  private selected: string[] = [];
  private hg!: Phaser.GameObjects.Graphics;

  constructor() {
    super('TypeChart');
  }

  init(data: { back?: ChartReturn; highlight?: string[] }): void {
    this.back = data.back;
    this.selected = data.highlight ?? [];
  }

  create(): void {
    ensureIcons(this);
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    // top bar
    const bar = this.add.graphics();
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => {
      if (this.back) this.scene.start(this.back.scene, this.back.data);
      else this.scene.start('Home');
    }, '18px');
    this.add
      .text(width / 2, 55, 'TYPE CHART', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
      .setOrigin(0.5);

    this.buildGrid();
    this.buildLegend(GRID_Y + ALL_TYPES.length * CELL + 28);
  }

  private buildGrid(): void {
    const g = this.add.graphics();
    const gridW = HEADER_W + ALL_TYPES.length * CELL;

    // headers: attacker badges down the left, defender badges (rotated)
    // across the top. Tapping a header highlights that type's row + column.
    ALL_TYPES.forEach((type, i) => {
      this.badge(GRID_X + HEADER_W / 2, GRID_Y + i * CELL + CELL / 2, type, false);
      this.badge(GRID_X + HEADER_W + i * CELL + CELL / 2, GRID_Y - 54, type, true);
      this.add
        .rectangle(GRID_X + HEADER_W / 2, GRID_Y + i * CELL + CELL / 2, HEADER_W, CELL, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.toggleType(type));
      this.add
        .rectangle(GRID_X + HEADER_W + i * CELL + CELL / 2, GRID_Y - 52, CELL, 104, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.toggleType(type));
    });

    // cells
    ALL_TYPES.forEach((att, r) => {
      const cy = GRID_Y + r * CELL + CELL / 2;
      ALL_TYPES.forEach((def, c) => {
        const mult = effectiveness(att, def);
        if (mult === 1) return;
        const cx = GRID_X + HEADER_W + c * CELL + CELL / 2;
        let fill = COLORS.sage;
        let mark = '2';
        let markColor = HEX.ink;
        if (mult === 0) {
          fill = COLORS.ink;
          mark = 'X';
          markColor = HEX.parchment;
        } else if (mult < 1) {
          fill = COLORS.adobeRed;
          mark = '.5';
        }
        g.fillStyle(fill);
        g.fillRect(cx - CELL / 2, cy - CELL / 2, CELL, CELL);
        this.add
          .text(cx, cy, mark, { fontFamily: FONT.ui, fontSize: '16px', color: markColor })
          .setOrigin(0.5);
      });
    });

    // grid lines over the fills
    g.lineStyle(1, COLORS.ink, 0.25);
    for (let i = 0; i <= ALL_TYPES.length; i++) {
      g.lineBetween(GRID_X, GRID_Y + i * CELL, GRID_X + gridW, GRID_Y + i * CELL);
      g.lineBetween(GRID_X + HEADER_W + i * CELL, GRID_Y, GRID_X + HEADER_W + i * CELL, GRID_Y + ALL_TYPES.length * CELL);
    }
    g.lineStyle(3, COLORS.ink, 0.7);
    g.strokeRect(GRID_X, GRID_Y, gridW, ALL_TYPES.length * CELL);

    // denim outline on the highlighted type(s) - redrawn on header taps
    this.hg = this.add.graphics();
    this.drawHighlights();
  }

  /** Tap a header: highlight only that type; tap it again to clear. */
  private toggleType(type: string): void {
    if (this.selected.length === 1 && this.selected[0] === type) this.selected = [];
    else this.selected = [type];
    this.drawHighlights();
  }

  private drawHighlights(): void {
    const gridW = HEADER_W + ALL_TYPES.length * CELL;
    this.hg.clear();
    for (const t of this.selected) {
      const idx = ALL_TYPES.indexOf(t);
      if (idx < 0) continue;
      this.hg.fillStyle(COLORS.denim, 0.12);
      this.hg.fillRect(GRID_X, GRID_Y + idx * CELL, gridW, CELL);
      this.hg.fillRect(GRID_X + HEADER_W + idx * CELL, GRID_Y - 104, CELL, 104 + ALL_TYPES.length * CELL);
      this.hg.lineStyle(4, COLORS.denim, 1);
      this.hg.strokeRect(GRID_X, GRID_Y + idx * CELL, gridW, CELL);
      this.hg.strokeRect(GRID_X + HEADER_W + idx * CELL, GRID_Y - 104, CELL, 104 + ALL_TYPES.length * CELL);
    }
  }

  private buildLegend(y: number): void {
    const g = this.add.graphics();
    const item = (x: number, fill: number, mark: string, markColor: string, label: string) => {
      g.fillStyle(fill);
      g.fillRect(x, y - 13, 26, 26);
      this.add
        .text(x + 13, y, mark, { fontFamily: FONT.ui, fontSize: '15px', color: markColor })
        .setOrigin(0.5);
      this.add
        .text(x + 36, y, label, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
        .setOrigin(0, 0.5);
    };
    item(52, COLORS.sage, '2', HEX.ink, '2X');
    item(180, COLORS.adobeRed, '.5', HEX.ink, 'HALF');
    item(340, COLORS.ink, 'X', HEX.parchment, 'NO EFFECT');
    this.add
      .text(52, y + 40, 'BLANK = NORMAL DAMAGE', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
      .setOrigin(0, 0.5);
    this.add
      .text(52, y + 72, 'ROWS ATTACK - COLUMNS DEFEND', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
      .setOrigin(0, 0.5);
  }

  /** Badge art at grid-header size; rotated 90 degrees for column headers. */
  private badge(x: number, y: number, type: string, rotated: boolean): void {
    const key = `type-${type}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(x, y, key).setScale(2);
      if (rotated) img.setRotation(-Math.PI / 2);
    } else {
      const t = this.add
        .text(x, y, type.slice(0, 4).toUpperCase(), { fontFamily: FONT.ui, fontSize: '15px', color: HEX.saddle })
        .setOrigin(0.5);
      if (rotated) t.setRotation(-Math.PI / 2);
    }
  }
}
