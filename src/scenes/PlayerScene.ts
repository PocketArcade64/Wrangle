import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { gameState } from '../state/GameState';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { openCritterPicker } from '../ui/possePicker';
import { buildNav } from '../ui/nav';

/** Player profile - stats fill in as the systems come online. */
export class PlayerScene extends Phaser.Scene {
  constructor() {
    super('Player');
  }

  create(): void {
    ensureIcons(this);
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    this.add
      .text(width / 2, 64, gameState.data.playerName, {
        fontFamily: FONT.display,
        fontSize: '44px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    // portrait
    const g = this.add.graphics();
    drawPixelPanel(g, width / 2 - 70, 130, 140, 140, COLORS.parchmentLight, COLORS.saddle);
    this.add.image(width / 2, 200, 'icon-hat').setTint(COLORS.saddle).setScale(2);

    this.add
      .text(width / 2, 310, 'A stranger from another range.', {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      })
      .setOrigin(0.5);

    const rows: [string, string, string][] = [
      ['CRITTERS WRANGLED', `${gameState.data.herd.length}`, HEX.ink],
      ['BOUNTIES CLEARED', '0', HEX.ink],
      ['GOLD', `${gameState.data.currency}`, HEX.brass]
    ];
    rows.forEach(([label, value, color], i) => {
      const ry = 380 + i * 74;
      const rg = this.add.graphics();
      drawPixelPanel(rg, 60, ry, width - 120, 58, COLORS.parchmentLight, COLORS.saddle, 4);
      this.add
        .text(84, ry + 29, label, { fontFamily: FONT.ui, fontSize: '19px', color: HEX.saddle })
        .setOrigin(0, 0.5);
      this.add
        .text(width - 84, ry + 29, value, { fontFamily: FONT.ui, fontSize: '19px', color })
        .setOrigin(1, 0.5);
    });

    this.buildDisplaySlots(640);

    // gear + references
    const lassoY = 866;
    makeButton(this, width / 2, lassoY, 300, 64, 'UPGRADE LASSO', () =>
      this.scene.start('Lasso')
    );
    makeButton(this, width / 2, lassoY + 84, 300, 64, 'TYPE CHART', () =>
      this.scene.start('TypeChart', { back: { scene: 'Player' } })
    );
    // password-gated playtest tools (prompt pulls up the phone keyboard)
    makeButton(this, width / 2, lassoY + 168, 300, 64, 'DEV MENU', () => {
      const entered = window.prompt('Dev password:');
      if (entered === 'critter45') this.scene.start('Dev');
    });

    buildNav(this, 'player');
  }

  /**
   * Display critters: the two picks that headline the home diorama (empty
   * slots get random seen species out there instead).
   */
  private buildDisplaySlots(y: number): void {
    const { width } = this.scale;
    this.add
      .text(width / 2, y, 'DISPLAY CRITTERS', { fontFamily: FONT.ui, fontSize: '19px', color: HEX.saddle })
      .setOrigin(0.5);
    this.add
      .text(width / 2, y + 28, 'THESE TWO HEADLINE YOUR HOMESTEAD', {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.sage
      })
      .setOrigin(0.5);

    const cy = y + 106;
    for (let i = 0; i < 2; i++) {
      const sx = width / 2 + (i === 0 ? -64 : 64);
      this.add
        .rectangle(sx, cy, 96, 96, COLORS.parchmentLight)
        .setStrokeStyle(3, COLORS.saddle)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          const other = gameState.data.displayCritters[1 - i];
          const excluded = new Set<string>(other ? [other] : []);
          openCritterPicker(
            this,
            excluded,
            (uid) => {
              gameState.data.displayCritters[i] = uid;
              gameState.save();
              this.scene.restart();
            },
            'YOUR OTHER DISPLAY SLOT ALREADY\nHOLDS EVERY CRITTER YOU OWN'
          );
        });
      const uid = gameState.data.displayCritters[i];
      const inst = uid ? gameState.data.herd.find((c) => c.uid === uid) : undefined;
      if (inst) {
        const sp = SPECIES.find((s) => s.id === inst.speciesId);
        const texKey = sp && this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
        this.add.image(sx, cy - 6, texKey).setDisplaySize(72, 72);
        this.add
          .text(sx, cy + 38, `LV ${inst.level}`, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle })
          .setOrigin(0.5);
      } else {
        this.add
          .text(sx, cy, '+', { fontFamily: FONT.display, fontSize: '34px', color: HEX.saddle })
          .setOrigin(0.5);
      }
    }
  }
}
