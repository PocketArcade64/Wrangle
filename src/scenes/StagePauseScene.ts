import Phaser from 'phaser';
import { sfx } from '../audio/audio';
import { FONT, HEX } from '../ui/theme';
import { makeButton } from '../ui/button';

/**
 * The stage pause overlay. StageScene launches this and pauses itself
 * (freezing its clock - cooldowns, telegraphs and hazards hold still).
 * RESUME runs a 3-2-1 countdown HERE, while the stage is still frozen,
 * then wakes the stage and closes.
 */
export class StagePauseScene extends Phaser.Scene {
  constructor() {
    super('StagePause');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.62);
    const title = this.add
      .text(width / 2, height * 0.36, 'TRAIL PAUSED', { fontFamily: FONT.display, fontSize: '44px', color: HEX.parchment })
      .setOrigin(0.5);
    const hint = this.add
      .text(width / 2, height * 0.36 + 56, 'THE WILDS WAIT ON YOU', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
      .setOrigin(0.5);
    const btn = makeButton(this, width / 2, height * 0.52, 300, 76, 'RESUME', () => {
      btn.destroy();
      title.destroy();
      hint.destroy();
      this.countdown(3);
    }, '22px');
  }

  /** 3... 2... 1... then the stage unfreezes. */
  private countdown(n: number): void {
    const { width, height } = this.scale;
    if (n <= 0) {
      this.scene.resume('Stage');
      this.scene.stop();
      return;
    }
    sfx('ui');
    const t = this.add
      .text(width / 2, height * 0.46, `${n}`, { fontFamily: FONT.display, fontSize: '120px', color: HEX.parchment })
      .setOrigin(0.5)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 620, duration: 160, onComplete: () => t.destroy() });
    this.time.delayedCall(800, () => this.countdown(n - 1));
  }
}
