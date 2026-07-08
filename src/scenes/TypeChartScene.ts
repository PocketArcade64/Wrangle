import Phaser from 'phaser';
import { ALL_TYPES, offenseProfile } from '../data/typeChart';
import { COLORS, FONT, HEX } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';

const TOP_BAR_H = 110;

/** Where BACK should return to (set by whoever opened the chart). */
interface ChartReturn {
  scene: string;
  data?: Record<string, unknown>;
}

/**
 * Quick-view reference of the full 17-type chart: one ruled section per
 * type showing what its attacks are STRONG / WEAK / NO EFFECT against,
 * rendered with the badge art. Drag to scroll. Reached from critter
 * pages, ledger pages and the player profile.
 */
export class TypeChartScene extends Phaser.Scene {
  private back?: ChartReturn;
  private listContainer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private minScroll = 0;
  private dragging = false;
  private dragStartY = 0;
  private scrollStart = 0;

  constructor() {
    super('TypeChart');
  }

  init(data: { back?: ChartReturn }): void {
    this.back = data.back;
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.scrollY = 0;
    this.dragging = false;

    this.listContainer = this.add.container(0, 0);
    this.listContainer.add(
      this.add
        .text(width / 2, TOP_BAR_H + 28, 'DAMAGE DEALT BY EACH TYPE', {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.sage
        })
        .setOrigin(0.5)
    );

    let cy = TOP_BAR_H + 56;
    for (const type of ALL_TYPES) {
      cy = this.buildTypeBlock(type, cy);
    }
    this.minScroll = Math.min(0, height - cy - 30);
    this.bindScroll();

    // top bar over the scrolling content
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => {
      if (this.back) this.scene.start(this.back.scene, this.back.data);
      else this.scene.start('Home');
    }, '18px').setDepth(11);
    this.add
      .text(width / 2 + 30, 55, 'TYPE CHART', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
      .setOrigin(0.5)
      .setDepth(11);
  }

  private bindScroll(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < TOP_BAR_H) return;
      this.dragging = true;
      this.dragStartY = p.y;
      this.scrollStart = this.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      this.scrollY = Phaser.Math.Clamp(this.scrollStart + (p.y - this.dragStartY), this.minScroll, 0);
      this.listContainer.y = this.scrollY;
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
    });
  }

  /** One ruled section for a type; returns the y where the next starts. */
  private buildTypeBlock(type: string, y: number): number {
    const { width } = this.scale;
    const g = this.add.graphics();
    this.listContainer.add(g);
    g.fillStyle(COLORS.saddle);
    g.fillRect(40, y, width - 80, 2);
    this.listContainer.add(this.badge(40 + 69, y + 42, type, 3));

    let cy = y + 82;
    const prof = offenseProfile(type);
    cy = this.category('STRONG VS (2X)', prof.strong, cy);
    cy = this.category('WEAK VS (1/2X)', prof.weak, cy);
    cy = this.category('NO EFFECT (0X)', prof.none, cy);
    if (prof.strong.length + prof.weak.length + prof.none.length === 0) {
      const t = this.add.text(48, cy, 'NO TYPE MODIFIERS', {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      });
      this.listContainer.add(t);
      cy += 40;
    }
    return cy + 16;
  }

  /** Label plus a wrapping row of type badges; skipped when empty. */
  private category(label: string, list: string[], y: number): number {
    if (list.length === 0) return y;
    const { width } = this.scale;
    const t = this.add.text(48, y, label, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage });
    this.listContainer.add(t);
    let x = 48;
    let ry = y + 46;
    for (const type of list) {
      if (x + 92 > width - 40) {
        x = 48;
        ry += 38;
      }
      this.listContainer.add(this.badge(x + 46, ry, type, 2));
      x += 100;
    }
    return ry + 31;
  }

  /** Badge art (canon names), with a text fallback if the art is missing. */
  private badge(x: number, y: number, type: string, scale: number): Phaser.GameObjects.GameObject {
    const key = `type-${type}`;
    if (this.textures.exists(key)) {
      return this.add.image(x, y, key).setScale(scale);
    }
    return this.add
      .text(x, y, type.toUpperCase(), {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.parchment,
        backgroundColor: HEX.saddle,
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5);
  }
}
