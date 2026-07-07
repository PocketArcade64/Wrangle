import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { gameState } from '../state/GameState';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

const TOP_BAR_H = 110;
const COLS = 3;
const CELL_W = 226;
const CELL_H = 276;
const TAP_SLOP = 12; // px of drag allowed before a release stops counting as a tap
const MAX_TEAMS = 4;

type CritterTab = 'posses' | 'herd' | 'tally';

/**
 * The Critters screen, three tabs:
 * - POSSES: build teams of 3 from your herd.
 * - MY HERD: critters you've wrangled (from the save).
 * - FRONTIER LEDGER ('tally' internally): the full species register, dex
 *   style - uncaught critters are ink silhouettes. Tap any entry to open
 *   its ledger page.
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
  private tempMsg?: Phaser.GameObjects.Text;

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
    this.minScroll = 0;
    this.tempMsg = undefined;

    const herd = gameState.data.herd
      .map((id) => SPECIES.find((s) => s.id === id))
      .filter((s): s is SpeciesDef => s !== undefined);

    this.listContainer = this.add.container(0, 0);

    if (this.activeTab === 'posses') {
      this.buildPosses();
    } else {
      const list = this.activeTab === 'tally' ? SPECIES : herd;
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
      this.bindScroll();
    }

    this.buildTopBar(herd.length);
    buildNav(this, 'collection');
  }

  private captureCount(id: string): number {
    return gameState.data.herd.filter((h) => h === id).length;
  }

  // ---------- top bar with the three tabs ----------

  private buildTopBar(herdCount: number): void {
    const { width } = this.scale;
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);

    const caught = new Set(gameState.data.herd).size;
    this.makeTab(width / 2 - 236, 'POSSES', 'posses');
    this.makeTab(width / 2, `HERD (${herdCount})`, 'herd');
    this.makeTab(width / 2 + 236, `LEDGER ${caught}/${SPECIES.length}`, 'tally');
  }

  private makeTab(x: number, label: string, tab: CritterTab): void {
    const active = tab === this.activeTab;
    const bg = this.add
      .rectangle(x, TOP_BAR_H / 2, 224, 64, active ? COLORS.parchmentLight : COLORS.parchmentDark)
      .setStrokeStyle(active ? 3 : 2, active ? COLORS.saddle : COLORS.saddleDark)
      .setDepth(11);
    this.add
      .text(x, TOP_BAR_H / 2, label, {
        fontFamily: FONT.ui,
        fontSize: '18px',
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

  // ---------- grid tabs (herd + ledger) ----------

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
        fontSize: '18px',
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
    const known = this.activeTab !== 'tally' || this.captureCount(sp.id) > 0;
    const bg = this.add
      .rectangle(x, y, CELL_W - 16, CELL_H - 16, COLORS.parchmentLight)
      .setStrokeStyle(3, COLORS.saddle);
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const img = this.add.image(x, y - 42, texKey).setScale(1.45);
    if (!known) img.setTintFill(COLORS.ink).setAlpha(0.8);
    const numLabel =
      this.activeTab === 'tally'
        ? `#${String(SPECIES.indexOf(sp) + 1).padStart(3, '0')}`
        : `#${index + 1}`;
    const num = this.add.text(x - (CELL_W - 16) / 2 + 8, y - (CELL_H - 16) / 2 + 6, numLabel, {
      fontFamily: FONT.ui,
      fontSize: '18px',
      color: HEX.saddle
    });
    const name = this.add
      .text(x, y + 46, known ? sp.name : '???', {
        fontFamily: FONT.ui,
        fontSize: '22px',
        color: HEX.ink,
        align: 'center',
        wordWrap: { width: CELL_W - 24 }
      })
      .setOrigin(0.5, 0);
    const typeLabel = known ? [sp.type1, sp.type2].filter(Boolean).join('/') : '???';
    const types = this.add
      .text(x, y + (CELL_H - 16) / 2 - 26, typeLabel, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      })
      .setOrigin(0.5, 0);

    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.dragDist < TAP_SLOP) this.scene.start('Ledger', { speciesId: sp.id });
    });

    this.listContainer.add([bg, img, num, name, types]);
  }

  // ---------- posses tab ----------

  private buildPosses(): void {
    const { width } = this.scale;
    const teams = gameState.data.teams;

    teams.forEach((team, ti) => {
      const py = TOP_BAR_H + 34 + ti * 204;
      const g = this.add.graphics();
      drawPixelPanel(g, 40, py, width - 80, 186, COLORS.parchmentLight, COLORS.saddle);
      this.add.text(70, py + 20, team.name, {
        fontFamily: FONT.display,
        fontSize: '24px',
        color: HEX.ink
      });
      if (ti === gameState.data.activeTeam) {
        this.add
          .text(width - 70, py + 24, 'ACTIVE', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.clay })
          .setOrigin(1, 0);
      }
      for (let si = 0; si < 3; si++) {
        this.makeSlot(team.members[si], ti, si, 128 + si * 132, py + 118);
      }
    });

    if (teams.length < MAX_TEAMS) {
      makeButton(this, width / 2, TOP_BAR_H + 34 + teams.length * 204 + 46, 300, 64, '+ NEW POSSE', () => {
        teams.push({ name: `POSSE ${teams.length + 1}`, members: [null, null, null] });
        gameState.save();
        this.scene.restart({ tab: 'posses' });
      }, '18px');
    }
  }

  private makeSlot(memberId: string | null, ti: number, si: number, x: number, y: number): void {
    const slot = this.add
      .rectangle(x, y, 108, 108, COLORS.parchmentDark)
      .setStrokeStyle(3, COLORS.saddle);
    if (memberId) {
      const sp = SPECIES.find((s) => s.id === memberId);
      const texKey = sp && this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
      this.add.image(x, y, texKey).setScale(1.15);
    } else {
      this.add
        .text(x, y, '+', { fontFamily: FONT.display, fontSize: '40px', color: HEX.saddle })
        .setOrigin(0.5);
    }
    slot.setInteractive({ useHandCursor: true }).on('pointerup', () => this.openSlotPicker(ti, si));
  }

  private openSlotPicker(ti: number, si: number): void {
    const { width, height } = this.scale;
    const unique = [...new Set(gameState.data.herd)];
    if (unique.length === 0) {
      this.showTempMsg('WRANGLE SOME CRITTERS FIRST');
      return;
    }

    const modal: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6)
      .setDepth(60)
      .setInteractive();
    modal.push(dim);
    const g = this.add.graphics().setDepth(61);
    drawPixelPanel(g, 50, 190, width - 100, 700, COLORS.parchment, COLORS.saddle);
    modal.push(g);
    modal.push(
      this.add
        .text(width / 2, 236, 'PICK A CRITTER', { fontFamily: FONT.display, fontSize: '28px', color: HEX.ink })
        .setOrigin(0.5)
        .setDepth(62)
    );

    const pick = (id: string | null) => {
      gameState.data.teams[ti].members[si] = id;
      gameState.save();
      this.scene.restart({ tab: 'posses' });
    };

    const options: (string | null)[] = [null, ...unique.slice(0, 15)];
    options.forEach((id, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 130 + col * 154;
      const y = 330 + row * 156;
      const cell = this.add
        .rectangle(x, y, 136, 136, COLORS.parchmentLight)
        .setStrokeStyle(3, COLORS.saddle)
        .setDepth(62)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => pick(id));
      modal.push(cell);
      if (id) {
        const sp = SPECIES.find((s) => s.id === id);
        const texKey = sp && this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
        modal.push(this.add.image(x, y - 14, texKey).setDepth(63));
        modal.push(
          this.add
            .text(x, y + 46, sp ? sp.name : id, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.ink })
            .setOrigin(0.5)
            .setDepth(63)
        );
      } else {
        modal.push(
          this.add
            .text(x, y, 'CLEAR', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
            .setOrigin(0.5)
            .setDepth(63)
        );
      }
    });

    dim.on('pointerup', () => modal.forEach((o) => o.destroy()));
  }

  private showTempMsg(msg: string): void {
    const { width, height } = this.scale;
    this.tempMsg?.destroy();
    this.tempMsg = this.add
      .text(width / 2, height - NAV_HEIGHT - 50, msg, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.saddle
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: this.tempMsg, alpha: 0, delay: 1100, duration: 300 });
  }
}
