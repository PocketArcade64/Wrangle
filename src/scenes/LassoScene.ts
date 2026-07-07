import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { LASSO_UPGRADES, LassoUpgradeDef, upgradeCost } from '../data/lassoUpgrades';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { buildNav } from '../ui/nav';

/**
 * The lasso upgrade menu: spend Dust on named stats, each repeatable to a
 * max with escalating costs (classic diminishing-returns investment).
 */
export class LassoScene extends Phaser.Scene {
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Lasso');
  }

  create(): void {
    ensureIcons(this);
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    this.add
      .text(width / 2, 60, 'THE LASSO', {
        fontFamily: FONT.display,
        fontSize: '44px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    this.add.image(90, 150, 'icon-lasso').setTint(COLORS.saddle).setScale(2);

    // Dust balance (brass, as always)
    this.add.image(width - 150, 150, 'icon-coin').setTint(COLORS.brass);
    this.add
      .text(width - 120, 150, `${gameState.data.currency}`, {
        fontFamily: FONT.ui,
        fontSize: '24px',
        color: HEX.brass
      })
      .setOrigin(0, 0.5);

    LASSO_UPGRADES.forEach((def, i) => this.buildRow(def, 220 + i * 190));

    this.feedback = this.add
      .text(width / 2, 220 + LASSO_UPGRADES.length * 190 + 10, '', {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.saddle
      })
      .setOrigin(0.5)
      .setAlpha(0);

    buildNav(this, 'player');
  }

  private buildRow(def: LassoUpgradeDef, y: number): void {
    const { width } = this.scale;
    const level = gameState.data.lasso[def.key];
    const maxed = level >= def.maxLevel;

    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 166, COLORS.parchmentLight, COLORS.saddle);

    this.add.text(70, y + 24, def.name, {
      fontFamily: FONT.ui,
      fontSize: '20px',
      color: HEX.ink
    });
    this.add.text(70, y + 60, def.desc, {
      fontFamily: FONT.ui,
      fontSize: '14px',
      color: HEX.sage,
      wordWrap: { width: width - 320 }
    });

    // level pips - flat squares, filled per owned level
    for (let i = 0; i < def.maxLevel; i++) {
      const pip = this.add.rectangle(82 + i * 32, y + 122, 20, 20, COLORS.saddle);
      if (i >= level) pip.setFillStyle(COLORS.parchmentLight).setStrokeStyle(2, COLORS.saddle);
    }

    if (maxed) {
      this.add
        .text(width - 130, y + 88, 'MAXED', {
          fontFamily: FONT.ui,
          fontSize: '20px',
          color: HEX.sage
        })
        .setOrigin(0.5);
      return;
    }

    const cost = upgradeCost(def, level);
    makeButton(this, width - 130, y + 70, 160, 54, 'UPGRADE', () => this.buy(def), '16px');
    this.add.image(width - 172, y + 124, 'icon-coin').setTint(COLORS.brass).setScale(0.55);
    this.add
      .text(width - 150, y + 124, `${cost}`, {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.brass
      })
      .setOrigin(0, 0.5);
  }

  private buy(def: LassoUpgradeDef): void {
    const level = gameState.data.lasso[def.key];
    if (level >= def.maxLevel) return;
    const cost = upgradeCost(def, level);
    if (gameState.data.currency < cost) {
      this.feedback.setText('NOT ENOUGH DUST').setAlpha(1);
      this.tweens.add({ targets: this.feedback, alpha: 0, delay: 900, duration: 300 });
      return;
    }
    gameState.data.currency -= cost;
    gameState.data.lasso[def.key] = level + 1;
    gameState.save();
    this.scene.restart();
  }
}
