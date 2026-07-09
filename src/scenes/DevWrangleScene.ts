import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { COLORS, FONT, HEX } from '../ui/theme';
import { makeButton } from '../ui/button';

const COLS = 4;
const CELL_W = 164;
const CELL_H = 150;
const GRID_TOP = 150;

/**
 * Dev submenu: every species in the game, tap one to jump straight into
 * its capture mini-game. This replaced the ledger's TEST WRANGLE button -
 * playtesters get everything here, players catch critters on the trail.
 */
export class DevWrangleScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private minScroll = 0;
  private dragging = false;
  private dragStartY = 0;
  private scrollStart = 0;
  private scrollVel = 0;
  private lastMoveY = 0;
  private lastMoveT = 0;
  private dragDist = 0;

  constructor() {
    super('DevWrangle');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.scrollY = 0;
    this.dragging = false;
    this.scrollVel = 0;
    this.dragDist = 0;

    this.content = this.add.container(0, 0);

    // grid of every species, dex order
    SPECIES.forEach((sp, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = width / 2 + (col - (COLS - 1) / 2) * CELL_W;
      const y = GRID_TOP + row * CELL_H + CELL_H / 2;
      const cell = this.add
        .rectangle(x, y, CELL_W - 12, CELL_H - 12, COLORS.parchmentLight)
        .setStrokeStyle(3, COLORS.saddle)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', (p: Phaser.Input.Pointer) => {
          // ignore drags and taps on cells scrolled under the top bar
          if (this.dragDist >= 10 || p.y < 116) return;
          this.scene.start('Capture', { speciesId: sp.id });
        });
      this.content.add(cell);
      const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
      this.content.add(this.add.image(x, y - 16, texKey).setDisplaySize(80, 80));
      this.content.add(
        this.add
          .text(x, y + 42, sp.name, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.ink })
          .setOrigin(0.5)
      );
    });

    const rows = Math.ceil(SPECIES.length / COLS);
    this.minScroll = Math.min(0, height - 40 - (GRID_TOP + rows * CELL_H));
    this.bindScroll();

    // fixed top bar over the scrolling grid
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, 110);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, 106, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => this.scene.start('Dev'), '18px').setDepth(11);
    this.add
      .text(width / 2, 55, 'TEST WRANGLE', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
      .setOrigin(0.5)
      .setDepth(11);
  }

  private bindScroll(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragStartY = p.y;
      this.scrollStart = this.scrollY;
      this.scrollVel = 0;
      this.dragDist = 0;
      this.lastMoveY = p.y;
      this.lastMoveT = this.time.now;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      this.dragDist = Math.max(this.dragDist, Math.abs(p.y - this.dragStartY));
      this.scrollY = Phaser.Math.Clamp(this.scrollStart + (p.y - this.dragStartY), this.minScroll, 0);
      this.content.y = this.scrollY;
      const now = this.time.now;
      const dtm = Math.max(1, now - this.lastMoveT);
      this.scrollVel = ((p.y - this.lastMoveY) / dtm) * 16.7;
      this.lastMoveY = p.y;
      this.lastMoveT = now;
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
    });
  }

  update(_time: number, delta: number): void {
    if (this.dragging || !this.content || Math.abs(this.scrollVel) < 0.5) return;
    const step = delta / 16.7;
    let ny = this.scrollY + this.scrollVel * step;
    if (ny > 0 || ny < this.minScroll) {
      ny = Phaser.Math.Clamp(ny, this.minScroll, 0);
      this.scrollVel = 0;
    } else {
      this.scrollVel *= Math.pow(0.94, step);
    }
    this.scrollY = ny;
    this.content.y = ny;
  }
}
