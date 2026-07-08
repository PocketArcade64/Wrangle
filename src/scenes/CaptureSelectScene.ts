import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { CritterInstance, gameState } from '../state/GameState';
import { releaseCritters } from '../state/herdOps';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { confirmDialog } from '../ui/confirm';
import { openPossePicker } from '../ui/possePicker';
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
 * - MY HERD: your specific critters. Tap one for its page; SELECT mode for
 *   Pokemon GO-style mass release (favorites are protected).
 * - FRONTIER LEDGER ('tally' internally): the species register - seen
 *   reveals sprite + name, caught reveals the record. Tap for the page.
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
  // herd select mode
  private selectMode = false;
  private selected = new Set<string>();
  private selectRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private releaseLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('CaptureSelect');
  }

  init(data: { tab?: CritterTab; select?: boolean }): void {
    this.activeTab = data.tab ?? 'herd';
    this.selectMode = (data.select ?? false) && this.activeTab === 'herd';
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
    this.selected = new Set();
    this.selectRects = new Map();
    this.releaseLabel = undefined;

    const herd = gameState.data.herd;

    this.listContainer = this.add.container(0, 0);

    if (this.activeTab === 'posses') {
      this.buildPosses();
    } else if (this.activeTab === 'herd' && herd.length === 0) {
      this.buildEmptyHerd();
      this.bindScroll();
    } else {
      const startX = (width - COLS * CELL_W) / 2 + CELL_W / 2;
      const startY = TOP_BAR_H + 30 + CELL_H / 2;
      if (this.activeTab === 'tally') {
        SPECIES.forEach((sp, i) => {
          this.makeCell(sp, i, startX + (i % COLS) * CELL_W, startY + Math.floor(i / COLS) * CELL_H);
        });
      } else {
        herd.forEach((inst, i) => {
          const sp = SPECIES.find((s) => s.id === inst.speciesId);
          if (!sp) return;
          this.makeCell(sp, i, startX + (i % COLS) * CELL_W, startY + Math.floor(i / COLS) * CELL_H, inst);
        });
      }
      const count = this.activeTab === 'tally' ? SPECIES.length : herd.length;
      const rowCount = Math.ceil(count / COLS);
      const contentBottom = TOP_BAR_H + 30 + rowCount * CELL_H + 110;
      this.minScroll = Math.min(0, height - NAV_HEIGHT - contentBottom);
      this.bindScroll();
      if (this.activeTab === 'herd') this.buildHerdActions();
    }

    this.buildTopBar(herd.length);
    buildNav(this, 'collection');
  }

  private captureCount(id: string): number {
    return gameState.data.herd.filter((c) => c.speciesId === id).length;
  }

  // ---------- top bar with the three tabs ----------

  private buildTopBar(herdCount: number): void {
    const { width } = this.scale;
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);

    this.makeTab(width / 2 - 236, 'POSSES', 'posses');
    this.makeTab(width / 2, `HERD (${herdCount})`, 'herd');
    this.makeTab(width / 2 + 236, 'FRONTIER LEDGER', 'tally');
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

  private makeCell(sp: SpeciesDef, index: number, x: number, y: number, inst?: CritterInstance): void {
    const caught = this.captureCount(sp.id) > 0;
    const seen = (gameState.data.seen[sp.id] ?? 0) > 0;
    // dex convention: seen reveals sprite + name; caught reveals details
    const revealed = this.activeTab !== 'tally' || caught || seen;
    const bg = this.add
      .rectangle(x, y, CELL_W - 16, CELL_H - 16, COLORS.parchmentLight)
      .setStrokeStyle(3, COLORS.saddle);
    const numLabel =
      this.activeTab === 'tally'
        ? `#${String(SPECIES.indexOf(sp) + 1).padStart(3, '0')}`
        : `#${index + 1}`;
    const cellTop = y - (CELL_H - 16) / 2;
    const num = this.add.text(x - (CELL_W - 16) / 2 + 8, cellTop + 6, numLabel, {
      fontFamily: FONT.ui,
      fontSize: '18px',
      color: HEX.saddle
    });
    // sprite fills the band between the dex number and the name, with a
    // little room above and below
    const numBottom = cellTop + 28;
    const nameTop = y + 46;
    const band = nameTop - numBottom;
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const img = this.add
      .image(x, numBottom + band / 2, texKey)
      .setDisplaySize(band - 24, band - 24);
    if (!revealed) img.setTintFill(COLORS.ink).setAlpha(0.8);
    const name = this.add
      .text(x, nameTop, revealed ? sp.name : '???', {
        fontFamily: FONT.ui,
        fontSize: '22px',
        color: HEX.ink,
        align: 'center',
        wordWrap: { width: CELL_W - 24 }
      })
      .setOrigin(0.5, 0);
    const typeLabel =
      this.activeTab !== 'tally' || caught ? [sp.type1, sp.type2].filter(Boolean).join('/') : '???';
    const types = this.add
      .text(x, y + (CELL_H - 16) / 2 - 26, typeLabel, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      })
      .setOrigin(0.5, 0);

    const parts: Phaser.GameObjects.GameObject[] = [bg, img, num, name, types];

    if (inst) {
      if (inst.favorite) {
        parts.push(
          this.add
            .image(x + (CELL_W - 16) / 2 - 20, cellTop + 20, 'icon-star')
            .setScale(0.55)
            .setTint(COLORS.clay)
        );
      }
      const sel = this.add
        .rectangle(x, y, CELL_W - 8, CELL_H - 8)
        .setStrokeStyle(5, COLORS.clay)
        .setVisible(this.selected.has(inst.uid));
      parts.push(sel);
      this.selectRects.set(inst.uid, sel);
    }

    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.dragDist >= TAP_SLOP) return;
      if (this.activeTab === 'tally') {
        this.scene.start('Ledger', { speciesId: sp.id });
      } else if (inst && this.selectMode) {
        this.toggleSelect(inst);
      } else if (inst) {
        this.scene.start('Critter', { uid: inst.uid });
      }
    });

    this.listContainer.add(parts);
  }

  // ---------- herd select / mass release (Pokemon GO style) ----------

  private buildHerdActions(): void {
    const { width, height } = this.scale;
    const y = height - NAV_HEIGHT - 48;
    if (!this.selectMode) {
      makeButton(this, width - 120, y, 170, 56, 'SELECT', () =>
        this.scene.restart({ tab: 'herd', select: true })
      , '18px').setDepth(30);
      return;
    }
    makeButton(this, 120, y, 170, 56, 'CANCEL', () => this.scene.restart({ tab: 'herd' }), '18px').setDepth(30);
    const btn = makeButton(this, width - 190, y, 310, 56, '', () => this.tryMassRelease(), '18px').setDepth(30);
    // grab the label of the button to keep the count live
    this.releaseLabel = btn.list[2] as Phaser.GameObjects.Text;
    this.updateReleaseLabel();
  }

  private updateReleaseLabel(): void {
    this.releaseLabel?.setText(`TURN LOOSE (${this.selected.size})`);
  }

  private toggleSelect(inst: CritterInstance): void {
    if (inst.favorite) {
      this.showTempMsg("FAVORITES CAN'T BE TURNED LOOSE");
      return;
    }
    if (this.selected.has(inst.uid)) this.selected.delete(inst.uid);
    else this.selected.add(inst.uid);
    this.selectRects.get(inst.uid)?.setVisible(this.selected.has(inst.uid));
    this.updateReleaseLabel();
  }

  private tryMassRelease(): void {
    const n = this.selected.size;
    if (n === 0) {
      this.showTempMsg('TAP CRITTERS TO SELECT THEM');
      return;
    }
    if (n >= gameState.data.herd.length) {
      this.showTempMsg('KEEP AT LEAST ONE CRITTER');
      return;
    }
    confirmDialog(
      this,
      'TURN LOOSE?',
      `${n} critter${n > 1 ? 's' : ''} will wander back to the wild. This can't be undone.`,
      'RELEASE',
      () => {
        releaseCritters([...this.selected]);
        this.scene.restart({ tab: 'herd' });
      },
      true
    );
  }

  // ---------- posses tab ----------

  private buildPosses(): void {
    const { width } = this.scale;
    const teams = gameState.data.teams;

    teams.forEach((team, ti) => {
      const py = TOP_BAR_H + 34 + ti * 204;
      const g = this.add.graphics();
      drawPixelPanel(g, 40, py, width - 80, 186, COLORS.parchmentLight, COLORS.saddle);
      // name - tap to rename (underline hints it's editable)
      const nameTxt = this.add.text(70, py + 20, team.name, {
        fontFamily: FONT.display,
        fontSize: '24px',
        color: HEX.ink
      });
      g.fillStyle(COLORS.saddle);
      g.fillRect(70, py + 50, Math.max(60, nameTxt.width), 2);
      nameTxt.setInteractive({ useHandCursor: true }).on('pointerup', () => this.renamePosse(ti));
      if (ti === gameState.data.activeTeam) {
        this.add
          .text(width - 116, py + 26, 'ACTIVE', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.clay })
          .setOrigin(1, 0);
      }
      // delete (min one posse always remains)
      const del = this.add.image(width - 78, py + 34, 'icon-x').setTint(COLORS.saddle).setScale(0.7);
      del.setInteractive({ useHandCursor: true }).on('pointerup', () => this.deletePosse(ti));
      // three slots, evenly spaced across the panel
      for (let si = 0; si < 3; si++) {
        this.makeSlot(team.members[si], ti, si, width / 2 + (si - 1) * 200, py + 118);
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

  private renamePosse(ti: number): void {
    const team = gameState.data.teams[ti];
    const entered = window.prompt('Name this posse:', team.name);
    if (entered === null) return;
    const cleaned = entered.trim().toUpperCase().slice(0, 14);
    if (cleaned.length === 0) return;
    team.name = cleaned;
    gameState.save();
    this.scene.restart({ tab: 'posses' });
  }

  private deletePosse(ti: number): void {
    const teams = gameState.data.teams;
    if (teams.length <= 1) {
      this.showTempMsg('A DRIFTER NEEDS AT LEAST ONE POSSE');
      return;
    }
    confirmDialog(this, 'DISBAND POSSE?', `${teams[ti].name} will ride off for good.`, 'DISBAND', () => {
      teams.splice(ti, 1);
      if (gameState.data.activeTeam >= teams.length) gameState.data.activeTeam = teams.length - 1;
      else if (gameState.data.activeTeam > ti) gameState.data.activeTeam--;
      gameState.save();
      this.scene.restart({ tab: 'posses' });
    });
  }

  /**
   * Posse slot: tap a filled slot to open that critter's page; long-press
   * (or tap an empty slot) to open the picker, which includes CLEAR.
   */
  private makeSlot(memberId: string | null, ti: number, si: number, x: number, y: number): void {
    const slot = this.add
      .rectangle(x, y, 108, 108, COLORS.parchmentDark)
      .setStrokeStyle(3, COLORS.saddle);
    if (memberId) {
      const sp = SPECIES.find((s) => s.id === memberId);
      const texKey = sp && this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
      this.add.image(x, y, texKey).setDisplaySize(92, 92);
    } else {
      this.add
        .text(x, y, '+', { fontFamily: FONT.display, fontSize: '40px', color: HEX.saddle })
        .setOrigin(0.5);
    }

    const openPicker = () => {
      if (!openPossePicker(this, ti, si, () => this.scene.restart({ tab: 'posses' }))) {
        this.showTempMsg('WRANGLE SOME CRITTERS FIRST');
      }
    };
    let pressTimer: Phaser.Time.TimerEvent | undefined;
    let longFired = false;
    slot
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        longFired = false;
        pressTimer = this.time.delayedCall(450, () => {
          longFired = true;
          openPicker();
        });
      })
      .on('pointerout', () => pressTimer?.remove())
      .on('pointerup', () => {
        pressTimer?.remove();
        if (longFired) return;
        if (memberId) {
          const inst = gameState.data.herd.find((c) => c.speciesId === memberId);
          if (inst) {
            this.scene.start('Critter', { uid: inst.uid });
            return;
          }
        }
        openPicker();
      });
  }

  private showTempMsg(msg: string): void {
    const { width, height } = this.scale;
    this.tempMsg?.destroy();
    this.tempMsg = this.add
      .text(width / 2, height - NAV_HEIGHT - 120, msg, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.saddle
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({ targets: this.tempMsg, alpha: 0, delay: 1100, duration: 300 });
  }
}
