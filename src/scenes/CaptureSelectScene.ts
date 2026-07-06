import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { gameState } from '../state/GameState';
import { COLORS, FONT, HEX } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

const TOP_BAR_H = 110;
const COLS = 3;
const CELL_W = 226;
const CELL_H = 250;
const TAP_SLOP = 12; // px of drag allowed before a release stops counting as a tap

type CritterTab = 'herd' | 'tally';

/**
 * The Critters screen, two tabs:
 * - MY HERD: critters you've wrangled (from the save).
 * - TALLY BOOK: the full species register (the "dex", in rancher terms).
 *   Doubles as the Explore target-picker until the map (M4) exists -
 *   tapping a tally entry starts a capture attempt.
 */
export class CaptureSelectScene extends Phaser.Scene {
  private activeTab: CritterTab = 'herd';
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

  init(data: { tab?: CritterTab }): void {
    this.activeTab = data.tab ?? 'herd';
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.scrollY = 0;
    this.dragging = false;
    this.dragDist = 0;

    const herd = gameState.data.herd
      .map((id) => SPECIES.find((s) => s.id === id))
      .filter((s): s is SpeciesDef => s !== undefined);
    const list = this.activeTab === 'tally' ? SPECIES : herd;

    this.listContainer = this.add.container(0, 0);

    if (list.length === 0) {
      this.buildEmptyHerd();
    } else {
      const startX = (width - COLS * CELL_W) / 2 + CELL_W / 2;
      const startY = TOP_BAR_H + 30 + CELL_H / 2;
      list.forEach((sp, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        this.makeCell(sp, i, startX + col * CELL_W, startY + row * CELL_H);
      });
      const rowCount = Math.ceil(list.length / COLS);
      const contentBottom = TOP_BAR_H + 30 + rowCount * CELL_H + 30;
      this.minScroll = Math.min(0, height - NAV_HEIGHT - contentBottom);
    }

    this.buildTopBar(herd.length);
    this.bindScroll();
    buildNav(this, 'collection');
  }

  // ---------- top bar with the two tabs ----------

  private buildTopBar(herdCount: number): void {
    const { width } = this.scale;
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);

    this.makeTab(width / 2 - 160, `MY HERD (${herdCount})`, 'herd');
    this.makeTab(width / 2 + 160, `TALLY BOOK (${SPECIES.length})`, 'tally');
  }

  private makeTab(x: number, label: string, tab: CritterTab): void {
    const active = tab === this.activeTab;
    const bg = this.add
      .rectangle(x, TOP_BAR_H / 2, 296, 64, active ? COLORS.parchmentLight : COLORS.parchmentDark)
      .setStrokeStyle(active ? 3 : 2, active ? COLORS.saddle : COLORS.saddleDark)
      .setDepth(11);
    this.add
      .text(x, TOP_BAR_H / 2, label, {
        fontFamily: FONT.ui,
        fontSize: '17px',
        color: active ? HEX.ink : HEX.saddle
      })
      .setOrigin(0.5)
      .setDepth(12);
    if (!active) {
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () =>
        this.scene.restart({ tab })
      );
    }
  }

  // ---------- list ----------

  private buildEmptyHerd(): void {
    const { width, height } = this.scale;
    const cy = (TOP_BAR_H + height - NAV_HEIGHT) / 2;
    this.add.image(width / 2, cy - 70, 'icon-lasso').setTint(COLORS.saddle).setScale(2.4);
    this.add
      .text(width / 2, cy + 20, 'YOUR HERD IS EMPTY', {
        fontFamily: FONT.display,
        fontSize: '30px',
        color: HEX.ink
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, cy + 66, 'Get out on the range and wrangle some critters.', {
        fontFamily: FONT.ui,
        fontSize: '15px',
        color: HEX.sage
      })
      .setOrigin(0.5);
  }

  private bindScroll(): void {
    const { height } = this.scale;
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
  }

  private makeCell(sp: SpeciesDef, index: number, x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, CELL_W - 16, CELL_H - 16, COLORS.parchmentLight)
      .setStrokeStyle(3, COLORS.saddle);
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const img = this.add.image(x, y - 38, texKey).setScale(1.1);
    const numLabel =
      this.activeTab === 'tally'
        ? `#${String(SPECIES.indexOf(sp) + 1).padStart(3, '0')}`
        : `#${index + 1}`;
    const num = this.add.text(x - (CELL_W - 16) / 2 + 8, y - (CELL_H - 16) / 2 + 6, numLabel, {
      fontFamily: FONT.ui,
      fontSize: '13px',
      color: HEX.saddle
    });
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
      if (this.dragDist >= TAP_SLOP) return;
      if (this.activeTab === 'tally') {
        this.scene.start('Capture', { speciesId: sp.id });
      } else {
        // herd critters just say howdy for now
        this.tweens.add({ targets: img, y: img.y - 12, duration: 120, yoyo: true });
      }
    });

    this.listContainer.add([bg, img, num, name, types]);
  }
}
