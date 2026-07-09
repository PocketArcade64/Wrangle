import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { gameState, newCritter } from '../state/GameState';
import { LEVEL_CAP } from '../battle/stats';
import { COLORS, FONT, HEX } from '../ui/theme';
import { makeButton } from '../ui/button';
import { confirmDialog } from '../ui/confirm';

/**
 * Playtest tools, reached from the Player screen behind the dev password.
 * Everything here mutates the real save - it exists to make testing
 * levels, moves and the ledger fast on-device.
 */
export class DevScene extends Phaser.Scene {
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Dev');
  }

  create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    const bar = this.add.graphics();
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, 110);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, 106, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => this.scene.start('Player'), '18px');
    this.add
      .text(width / 2, 55, 'DEV MENU', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
      .setOrigin(0.5);

    const buttons: [string, () => void][] = [
      ['+1000 GOLD', () => {
        gameState.data.currency += 1000;
        gameState.save();
        this.say(`GOLD: ${gameState.data.currency}`);
      }],
      ['REFILL STAMINA', () => {
        gameState.data.stamina = gameState.data.staminaMax;
        gameState.save();
        this.say('STAMINA REFILLED');
      }],
      ['GRANT RANDOM CRITTER', () => {
        const sp = SPECIES[Math.floor(Math.random() * SPECIES.length)];
        gameState.data.herd.push(newCritter(sp.id));
        gameState.data.seen[sp.id] = (gameState.data.seen[sp.id] ?? 0) + 1;
        gameState.save();
        this.say(`GRANTED ${sp.name.toUpperCase()}`);
      }],
      ['HERD +5 LEVELS', () => {
        for (const c of gameState.data.herd) {
          c.level = Math.min(LEVEL_CAP, c.level + 5);
          c.xp = 0;
        }
        gameState.save();
        this.say('HERD LEVELED UP +5');
      }],
      ['HERD BACK TO LV 1', () => {
        for (const c of gameState.data.herd) {
          c.level = 1;
          c.xp = 0;
        }
        gameState.save();
        this.say('HERD RESET TO LV 1');
      }],
      ['MARK ALL SPECIES SEEN', () => {
        for (const sp of SPECIES) {
          gameState.data.seen[sp.id] = (gameState.data.seen[sp.id] ?? 0) + 1;
        }
        gameState.save();
        this.say('LEDGER: EVERYTHING SEEN');
      }],
      ['RESET DAILY BONUS', () => {
        gameState.data.daily = { lastPunch: '', punchStreak: gameState.data.daily.punchStreak, lastSpin: '' };
        gameState.save();
        this.say('PUNCH + FREE SPIN RESET');
      }],
      ['TEST WRANGLE A CRITTER', () => this.scene.start('DevWrangle')],
      ['WIPE SAVE + RESTART', () => {
        confirmDialog(this, 'WIPE SAVE?', 'The whole save is erased and the game restarts.', 'WIPE', () =>
          gameState.hardReset()
        , true);
      }]
    ];
    buttons.forEach(([label, fn], i) => {
      makeButton(this, width / 2, 190 + i * 84, 420, 64, label, fn, '18px');
    });

    this.feedback = this.add
      .text(width / 2, 190 + buttons.length * 84 + 20, '', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
      .setOrigin(0.5);
  }

  private say(msg: string): void {
    this.feedback.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.feedback, alpha: 0, delay: 1400, duration: 300 });
  }
}
