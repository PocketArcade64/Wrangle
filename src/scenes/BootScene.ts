import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, 'WRANGLE', {
        fontFamily: 'Silkscreen',
        fontSize: '48px',
        color: '#f4a340'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 60, 'setup scaffold ok', {
        fontFamily: 'Silkscreen',
        fontSize: '16px',
        color: '#ffffff'
      })
      .setOrigin(0.5);
  }
}
