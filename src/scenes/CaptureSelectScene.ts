import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { makeButton } from '../ui/button';

export class CaptureSelectScene extends Phaser.Scene {
  constructor() {
    super('CaptureSelect');
  }

  create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor('#d9a066');

    this.add
      .text(width / 2, 80, 'PICK A TARGET', {
        fontFamily: 'Silkscreen',
        fontSize: '36px',
        color: '#3a2a1a'
      })
      .setOrigin(0.5);

    SPECIES.forEach((sp, i) => this.makeCard(sp, width / 2, 240 + i * 260));

    makeButton(this, width / 2, this.scale.height - 90, 200, 60, 'BACK', () => this.scene.start('Title'));
  }

  private makeCard(sp: SpeciesDef, x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, 640, 220, 0x5a3a22)
      .setStrokeStyle(4, 0x3a2a1a);
    this.add.image(x - 240, y, sp.textureKey).setScale(1.4);

    this.add.text(x - 130, y - 80, sp.name, {
      fontFamily: 'Silkscreen',
      fontSize: '30px',
      color: '#f4a340'
    });
    this.add.text(x - 130, y - 34, `LOOPS: ${sp.requiredLoops}`, {
      fontFamily: 'Silkscreen',
      fontSize: '18px',
      color: '#ffe9c9'
    });
    const danger = sp.attack === 'none' ? 'HARMLESS' : 'RADIAL BURST';
    this.add.text(x - 130, y - 4, `DANGER: ${danger}`, {
      fontFamily: 'Silkscreen',
      fontSize: '18px',
      color: sp.attack === 'none' ? '#a8d08d' : '#e05c4a'
    });
    this.add.text(x - 130, y + 34, sp.blurb, {
      fontFamily: 'Silkscreen',
      fontSize: '14px',
      color: '#c9b49a',
      wordWrap: { width: 400 }
    });

    bg.setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.scene.start('Capture', { speciesId: sp.id })
    );
  }
}
