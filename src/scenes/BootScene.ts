import Phaser from 'phaser';

/**
 * Generates placeholder creature textures (to be replaced by the real
 * pixel-art sprites) and waits for the Silkscreen webfont before starting.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'loading...', {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '20px',
        color: '#f4a340'
      })
      .setOrigin(0.5);

    this.makeCowTexture();
    this.makeChickenTexture();
    this.makeDustdevilTexture();

    const fonts = Promise.all([
      document.fonts.load('16px Silkscreen'),
      document.fonts.load('bold 16px Silkscreen')
    ]);
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([fonts, timeout])
      .catch(() => undefined)
      .then(() => this.scene.start('Title'));
  }

  private makeCowTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xf5f0e6);
    g.fillCircle(48, 52, 40);
    g.lineStyle(4, 0x3a2a1a);
    g.strokeCircle(48, 52, 40);
    // horns
    g.fillStyle(0xd9c9a0);
    g.fillTriangle(18, 20, 32, 28, 24, 38);
    g.fillTriangle(78, 20, 64, 28, 72, 38);
    // spots
    g.fillStyle(0x3a3a3a);
    g.fillCircle(28, 56, 9);
    g.fillCircle(66, 70, 7);
    // eyes
    g.fillStyle(0x1a1a1a);
    g.fillCircle(38, 42, 4);
    g.fillCircle(58, 42, 4);
    // snout
    g.fillStyle(0xe8b4b8);
    g.fillEllipse(48, 66, 26, 15);
    g.fillStyle(0x9a6a6e);
    g.fillCircle(43, 66, 2);
    g.fillCircle(53, 66, 2);
    g.generateTexture('pl-cow', 96, 96);
    g.destroy();
  }

  private makeChickenTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xf7e3a1);
    g.fillCircle(32, 36, 24);
    g.lineStyle(3, 0x3a2a1a);
    g.strokeCircle(32, 36, 24);
    // comb
    g.fillStyle(0xd9534f);
    g.fillCircle(26, 12, 5);
    g.fillCircle(35, 10, 5);
    // eyes
    g.fillStyle(0x1a1a1a);
    g.fillCircle(24, 32, 3);
    g.fillCircle(40, 32, 3);
    // beak
    g.fillStyle(0xe8963c);
    g.fillTriangle(27, 40, 37, 40, 32, 49);
    g.generateTexture('pl-chicken', 64, 64);
    g.destroy();
  }

  private makeDustdevilTexture(): void {
    const g = this.add.graphics();
    g.lineStyle(6, 0xb4763c);
    g.strokeCircle(44, 48, 32);
    g.lineStyle(5, 0xcf9a5b);
    g.strokeCircle(44, 52, 21);
    g.lineStyle(4, 0xe0b57e);
    g.strokeCircle(44, 56, 11);
    // angry eyes
    g.fillStyle(0xffffff);
    g.fillCircle(34, 34, 7);
    g.fillCircle(54, 34, 7);
    g.fillStyle(0x552200);
    g.fillCircle(35, 35, 3);
    g.fillCircle(53, 35, 3);
    g.lineStyle(4, 0x3a2a1a);
    g.lineBetween(26, 24, 40, 30);
    g.lineBetween(62, 24, 48, 30);
    g.generateTexture('pl-dust', 88, 88);
    g.destroy();
  }
}
