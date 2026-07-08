import Phaser from 'phaser';
import { gameState, StagePin } from '../state/GameState';
import { classifyMapPoint, FRONTIER_LEVELS, StageTheme } from '../data/stages';
import { dateKey } from '../util/daily';
import { playMusic, sfx } from '../audio/audio';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';

const TOP_BAR_H = 110;
/** Map-select tabs sit between the top bar and the map. */
const TABS_Y = 142;
const MAP_Y = 190;
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
  private mapScale = 720 / MAP_TEX;
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
    const map = this.add.image(0, MAP_Y, 'map-frontier').setOrigin(0);
    map.setDisplaySize(720, 720);
    map.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
      const tx = Phaser.Math.Clamp((p.x - 0) / this.mapScale, 0, MAP_TEX - 1);
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
    this.buildPinSlots(MAP_Y + 720 + 8);
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
      const sx = (pin.cellX * CELL + CELL / 2) * this.mapScale;
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
      .text(width / 2, MAP_Y + 660, msg, {
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
