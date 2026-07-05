import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#2a1a10');

    this.add
      .text(width / 2, height * 0.32, 'WRANGLE', {
        fontFamily: 'Silkscreen',
        fontSize: '72px',
        color: '#f4a340'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.32 + 70, "a lasso-'em-up", {
        fontFamily: 'Silkscreen',
        fontSize: '22px',
        color: '#c98d4b'
      })
      .setOrigin(0.5);

    const tap = this.add
      .text(width / 2, height * 0.62, 'TAP TO START', {
        fontFamily: 'Silkscreen',
        fontSize: '26px',
        color: '#ffe9c9'
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: tap,
      alpha: 0.25,
      duration: 650,
      yoyo: true,
      repeat: -1
    });

    this.add
      .text(width / 2, height - 40, 'capture prototype - m1', {
        fontFamily: 'Silkscreen',
        fontSize: '14px',
        color: '#7a5a3a'
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.scene.start('CaptureSelect'));
  }
}
