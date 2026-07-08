import Phaser from 'phaser';
import { gameState, StagePin } from '../state/GameState';
import { SpeciesDef } from '../data/species';
import { classifyMapPoint, FRONTIER_LEVELS, STAGE_THEMES, StageTheme, themeSpeciesPool } from '../data/stages';
import { dateKey } from '../util/daily';
import { playMusic, sfx } from '../audio/audio';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';

const TOP_BAR_H = 110;
/** Map-select tabs sit between the top bar and the map. */
const TABS_Y = 142;
const MAP_Y = 190;
const MAP_X = 30;
const MAP_VIEW = 660;
const MAP_TEX = 1024;
/** Pin coordinates quantize to this texture-space grid. */
const CELL = 32;

/**
 * The world map (Frontier Flats). Tap anywhere to scout that spot - the
 * map art under the tap decides the stage theme (content-aware) and the
 * cell + today's date seed the stage. Riding out costs 1 stamina and
 * saves the pin; the 3 saved pins replay free forever. One pin can be
 * favorited and is never overwritten.
 */
export class MapScene extends Phaser.Scene {
  private mapScale = MAP_VIEW / MAP_TEX;
  private tempMsg?: Phaser.GameObjects.Text;

  constructor() {
    super('Map');
  }

  create(): void {
    ensureIcons(this);
    gameState.refreshStamina();
    playMusic('home');
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.tempMsg = undefined;

    // the map itself
    const map = this.add.image(MAP_X, MAP_Y, 'map-frontier').setOrigin(0);
    map.setDisplaySize(MAP_VIEW, MAP_VIEW);
    map.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
      const tx = Phaser.Math.Clamp((p.x - MAP_X) / this.mapScale, 0, MAP_TEX - 1);
      const ty = Phaser.Math.Clamp((p.y - MAP_Y) / this.mapScale, 0, MAP_TEX - 1);
      this.scoutPoint(tx, ty);
    });
    this.drawPinMarkers();

    // top bar over everything
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, TOP_BAR_H);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, TOP_BAR_H - 4, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => this.scene.start('Home'), '18px').setDepth(11);
    if (this.textures.exists('map-logo')) {
      this.add.image(width / 2, 55, 'map-logo').setDepth(11);
    } else {
      this.add
        .text(width / 2, 55, 'FRONTIER FLATS', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
        .setOrigin(0.5)
        .setDepth(11);
    }
    this.add.image(width - 128, 55, 'icon-horseshoe').setTint(COLORS.sage).setScale(0.8).setDepth(11);
    this.add
      .text(width - 98, 55, `${gameState.data.stamina}/${gameState.data.staminaMax}`, {
        fontFamily: FONT.ui,
        fontSize: '24px',
        color: HEX.sage
      })
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.buildMapTabs();
    makeButton(this, width / 2, MAP_Y + MAP_VIEW + 34, 300, 48, 'AREA GUIDE', () => this.openAreaGuide(), '18px');
    this.buildPinSlots(MAP_Y + MAP_VIEW + 66);
  }

  /** Region tabs above the map: Frontier Flats now, more maps later. */
  private buildMapTabs(): void {
    const { width } = this.scale;
    // active: Frontier Flats with its critter level band
    this.add
      .rectangle(width / 2 - 174, TABS_Y, 330, 60, COLORS.parchmentLight)
      .setStrokeStyle(3, COLORS.saddle);
    this.add
      .text(width / 2 - 174, TABS_Y - 12, 'FRONTIER FLATS', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink })
      .setOrigin(0.5);
    this.add
      .text(width / 2 - 174, TABS_Y + 14, `CRITTERS LV ${FRONTIER_LEVELS.min}-${FRONTIER_LEVELS.max}`, {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.sage
      })
      .setOrigin(0.5);
    // placeholder for the next region
    this.add
      .rectangle(width / 2 + 174, TABS_Y, 330, 60, COLORS.parchmentDark)
      .setStrokeStyle(2, COLORS.saddleDark);
    this.add
      .text(width / 2 + 174, TABS_Y, 'COMING SOON', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  // ---------- pins ----------

  private drawPinMarkers(): void {
    for (const pin of gameState.data.pins) {
      const sx = MAP_X + (pin.cellX * CELL + CELL / 2) * this.mapScale;
      const sy = MAP_Y + (pin.cellY * CELL + CELL / 2) * this.mapScale;
      const g = this.add.graphics().setDepth(5);
      g.fillStyle(COLORS.ink);
      g.fillRect(sx - 10, sy - 26, 20, 20);
      g.fillTriangle(sx - 8, sy - 8, sx + 8, sy - 8, sx, sy + 4);
      g.fillStyle(pin.favorite ? COLORS.clay : COLORS.parchment);
      g.fillRect(sx - 6, sy - 22, 12, 12);
    }
  }

  private buildPinSlots(y: number): void {
    const { width } = this.scale;
    const pins = gameState.data.pins;
    for (let i = 0; i < 3; i++) {
      const sy = y + i * 106;
      const g = this.add.graphics();
      drawPixelPanel(g, 32, sy, width - 64, 96, COLORS.parchmentLight, COLORS.saddle, 4);
      const pin = pins[i];
      if (!pin) {
        this.add
          .text(width / 2, sy + 48, 'EMPTY SLOT - TAP THE MAP TO SCOUT', {
            fontFamily: FONT.ui,
            fontSize: '18px',
            color: HEX.sage
          })
          .setOrigin(0.5);
        continue;
      }
      this.add.text(56, sy + 16, pin.name, { fontFamily: FONT.display, fontSize: '22px', color: HEX.ink });
      this.add.text(56, sy + 52, `CELL ${pin.cellX}-${pin.cellY}${pin.completed ? '   CLEARED' : ''}`, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: pin.completed ? HEX.sage : HEX.saddle
      });
      // tap the pin's name area to preview what critters roam there
      this.add
        .rectangle(200, sy + 48, 330, 92, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.openSpeciesList(pin.themeId));
      // favorite star - only one pin may hold it
      const star = this.add.image(width - 260, sy + 48, 'icon-star').setScale(0.9);
      star.setTint(pin.favorite ? COLORS.clay : COLORS.saddle).setAlpha(pin.favorite ? 1 : 0.4);
      star.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        const was = pin.favorite;
        for (const p of gameState.data.pins) p.favorite = false;
        pin.favorite = !was;
        gameState.save();
        this.scene.restart();
      });
      makeButton(this, width - 130, sy + 48, 170, 56, 'RIDE FREE', () => this.startStage(pin), '18px');
    }
  }

  // ---------- area guide ----------

  /** All six regions of the map; tap one to see its critter pool. */
  private openAreaGuide(): void {
    const { width, height } = this.scale;
    const modal: Phaser.GameObjects.GameObject[] = [];
    const close = () => modal.forEach((o) => o.destroy());
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6)
      .setDepth(60)
      .setInteractive();
    dim.on('pointerup', close);
    modal.push(dim);
    const g = this.add.graphics().setDepth(61);
    drawPixelPanel(g, 60, 170, width - 120, 760, COLORS.parchment, COLORS.saddle);
    modal.push(g);
    modal.push(
      this.add
        .text(width / 2, 216, 'AREA GUIDE', { fontFamily: FONT.display, fontSize: '28px', color: HEX.ink })
        .setOrigin(0.5)
        .setDepth(62)
    );
    Object.values(STAGE_THEMES).forEach((theme, i) => {
      const ry = 286 + i * 104;
      const row = this.add
        .rectangle(width / 2, ry, width - 180, 92, COLORS.parchmentLight)
        .setStrokeStyle(3, COLORS.saddle)
        .setDepth(62)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          close();
          this.openSpeciesList(theme.id);
        });
      modal.push(row);
      const sw = this.add.rectangle(width / 2 - 220, ry, 44, 44, theme.ground).setStrokeStyle(2, COLORS.ink).setDepth(63);
      modal.push(sw);
      modal.push(
        this.add
          .text(width / 2 - 180, ry - 20, theme.name, { fontFamily: FONT.ui, fontSize: '20px', color: HEX.ink })
          .setOrigin(0, 0)
          .setDepth(63)
      );
      modal.push(
        this.add
          .text(width / 2 - 180, ry + 8, `${theme.types.join(' / ')} COUNTRY`, {
            fontFamily: FONT.ui,
            fontSize: '16px',
            color: HEX.sage
          })
          .setOrigin(0, 0)
          .setDepth(63)
      );
    });
  }

  /** The critters findable under a theme - silhouettes until first seen. */
  private openSpeciesList(themeId: string): void {
    const { width, height } = this.scale;
    const theme = STAGE_THEMES[themeId] ?? STAGE_THEMES.prairie;
    const pool = themeSpeciesPool(themeId).slice(0, 24);
    const modal: Phaser.GameObjects.GameObject[] = [];
    const close = () => modal.forEach((o) => o.destroy());
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6)
      .setDepth(60)
      .setInteractive();
    dim.on('pointerup', close);
    modal.push(dim);
    const rows = Math.max(1, Math.ceil(pool.length / 4));
    const panelH = 120 + rows * 140;
    const panelY = Math.max(130, (height - panelH) / 2);
    const g = this.add.graphics().setDepth(61);
    drawPixelPanel(g, 50, panelY, width - 100, panelH, COLORS.parchment, COLORS.saddle);
    modal.push(g);
    modal.push(
      this.add
        .text(width / 2, panelY + 44, `${theme.name} CRITTERS`, { fontFamily: FONT.display, fontSize: '26px', color: HEX.ink })
        .setOrigin(0.5)
        .setDepth(62)
    );
    pool.forEach((sp: SpeciesDef, i: number) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx = 128 + col * 155;
      const cy = panelY + 150 + row * 140;
      const seen = (gameState.data.seen[sp.id] ?? 0) > 0 || gameState.data.herd.some((c) => c.speciesId === sp.id);
      const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
      const img = this.add.image(cx, cy - 14, texKey).setDisplaySize(78, 78).setDepth(62);
      if (!seen) img.setTintFill(COLORS.ink).setAlpha(0.8);
      modal.push(img);
      modal.push(
        this.add
          .text(cx, cy + 40, seen ? sp.name : '???', { fontFamily: FONT.ui, fontSize: '16px', color: seen ? HEX.ink : HEX.sage })
          .setOrigin(0.5)
          .setDepth(62)
      );
    });
  }

  // ---------- scouting a new spot ----------

  private scoutPoint(tx: number, ty: number): void {
    const theme = classifyMapPoint(this, 'map-frontier', tx, ty);
    const cellX = Math.floor(tx / CELL);
    const cellY = Math.floor(ty / CELL);
    const { width, height } = this.scale;

    const modal: Phaser.GameObjects.GameObject[] = [];
    const close = () => modal.forEach((o) => o.destroy());
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6)
      .setDepth(60)
      .setInteractive();
    dim.on('pointerup', close);
    modal.push(dim);
    const g = this.add.graphics().setDepth(61);
    drawPixelPanel(g, width / 2 - 280, height / 2 - 190, 560, 380, COLORS.parchment, COLORS.saddle);
    modal.push(g);
    modal.push(
      this.add
        .text(width / 2, height / 2 - 130, 'SCOUT REPORT', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
        .setOrigin(0.5)
        .setDepth(62)
    );
    modal.push(
      this.add
        .text(width / 2, height / 2 - 84, theme.name, { fontFamily: FONT.display, fontSize: '34px', color: HEX.ink })
        .setOrigin(0.5)
        .setDepth(62)
    );
    modal.push(
      this.add
        .text(width / 2, height / 2 - 30, `CELL ${cellX}-${cellY}  -  ${theme.types.join(' / ')} COUNTRY`, {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.saddle
        })
        .setOrigin(0.5)
        .setDepth(62)
    );
    modal.push(
      this.add
        .text(width / 2, height / 2 + 8, 'TRAILS SHIFT AT SUNUP - PINNED STAGES KEEP FOREVER', {
          fontFamily: FONT.ui,
          fontSize: '16px',
          color: HEX.sage
        })
        .setOrigin(0.5)
        .setDepth(62)
    );
    modal.push(
      makeButton(this, width / 2 - 120, height / 2 + 110, 220, 64, 'RIDE OUT (1)', () => {
        close();
        this.tryNewPin(cellX, cellY, theme);
      }, '18px').setDepth(62)
    );
    modal.push(
      makeButton(this, width / 2 + 130, height / 2 + 110, 180, 64, 'CANCEL', close, '18px').setDepth(62)
    );
  }

  private tryNewPin(cellX: number, cellY: number, theme: StageTheme): void {
    gameState.refreshStamina();
    if (gameState.data.herd.length === 0) {
      this.showTempMsg('WRANGLE A CRITTER FIRST - LEDGER > TEST WRANGLE');
      return;
    }
    if (gameState.data.stamina < 1) {
      this.showTempMsg('OUT OF STAMINA - RESTS 1 PER HOUR');
      return;
    }
    gameState.data.stamina -= 1;
    gameState.data.staminaUpdatedAt = Math.min(gameState.data.staminaUpdatedAt, Date.now());
    const pin: StagePin = {
      cellX,
      cellY,
      seed: `stage-${dateKey()}-${cellX}-${cellY}`,
      themeId: theme.id,
      name: theme.name,
      favorite: false,
      completed: false,
      createdAt: Date.now()
    };
    const pins = gameState.data.pins;
    if (pins.length < 3) {
      pins.push(pin);
    } else {
      // replace the oldest non-favorite (only one favorite can exist)
      let idx = -1;
      for (let i = 0; i < pins.length; i++) {
        if (pins[i].favorite) continue;
        if (idx === -1 || pins[i].createdAt < pins[idx].createdAt) idx = i;
      }
      if (idx === -1) {
        this.showTempMsg('ALL PINS FAVORITED - UNFAVORITE ONE FIRST');
        gameState.data.stamina += 1;
        gameState.save();
        return;
      }
      pins[idx] = pin;
    }
    gameState.save();
    this.startStage(pin);
  }

  private startStage(pin: StagePin): void {
    if (gameState.data.herd.length === 0) {
      this.showTempMsg('WRANGLE A CRITTER FIRST - LEDGER > TEST WRANGLE');
      return;
    }
    sfx('dash');
    this.scene.start('Stage', { seed: pin.seed, themeId: pin.themeId });
  }

  private showTempMsg(msg: string): void {
    const { width } = this.scale;
    this.tempMsg?.destroy();
    this.tempMsg = this.add
      .text(width / 2, MAP_Y + 600, msg, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.parchment,
        backgroundColor: HEX.ink,
        padding: { x: 12, y: 8 }
      })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: this.tempMsg, alpha: 0, delay: 1600, duration: 300 });
  }
}
