import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { gameState } from '../state/GameState';
import { COLORS, FONT, HEX } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

const STATUS_H = 96;

/**
 * Home: quiet status bar, the living diorama (signature element), one clay
 * Explore CTA, a tucked satchel for the daily bonus, persistent nav.
 * Nothing competes for attention on load.
 */
export class HomeScene extends Phaser.Scene {
  private dioramaTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Home');
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);

    this.buildStatusBar();

    // living diorama fills the space between status bar and CTA band
    const dioX = 32;
    const dioY = STATUS_H + 30;
    const dioW = width - 64;
    const dioH = Phaser.Math.Clamp(height - STATUS_H - NAV_HEIGHT - 330, 400, 620);
    this.buildDiorama(dioX, dioY, dioW, dioH);

    // single accent CTA, centered in the band below the diorama
    const bandTop = dioY + dioH;
    const bandBottom = height - NAV_HEIGHT;
    const ctaY = bandTop + (bandBottom - bandTop) * 0.42;
    this.buildExploreCta(width / 2, ctaY);
    this.buildSatchel(width / 2, ctaY + 104);

    buildNav(this, 'home');
  }

  shutdown(): void {
    this.dioramaTimer?.remove();
  }

  // ---------- status bar ----------

  private buildStatusBar(): void {
    const { width } = this.scale;
    const g = this.add.graphics();
    g.fillStyle(COLORS.parchmentDark);
    g.fillRect(0, 0, width, STATUS_H);
    g.fillStyle(COLORS.saddle);
    g.fillRect(0, STATUS_H - 4, width, 4);

    // currency - brass, and only brass
    this.add.image(46, STATUS_H / 2, 'icon-coin').setTint(COLORS.brass);
    this.add
      .text(78, STATUS_H / 2, `${gameState.data.currency}`, {
        fontFamily: FONT.ui,
        fontSize: '24px',
        color: HEX.brass
      })
      .setOrigin(0, 0.5);

    // stamina pips - sage, calm; running low is not a failure state
    const pipX = width / 2 - 40;
    for (let i = 0; i < gameState.data.staminaMax; i++) {
      const filled = i < gameState.data.stamina;
      const pip = this.add.rectangle(pipX + i * 30, STATUS_H / 2, 20, 20, COLORS.sage);
      if (!filled) pip.setFillStyle(COLORS.parchmentDark).setStrokeStyle(2, COLORS.sage);
    }
    this.add
      .text(pipX + gameState.data.staminaMax * 30 + 12, STATUS_H / 2, `${gameState.data.stamina}/${gameState.data.staminaMax}`, {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.sage
      })
      .setOrigin(0, 0.5);

    // avatar - square frame, tap for player screen
    const av = this.add.graphics();
    av.fillStyle(COLORS.ink);
    av.fillRect(width - 88, STATUS_H / 2 - 31, 62, 62);
    av.fillStyle(COLORS.saddle);
    av.fillRect(width - 86, STATUS_H / 2 - 29, 58, 58);
    av.fillStyle(COLORS.parchment);
    av.fillRect(width - 82, STATUS_H / 2 - 25, 50, 50);
    this.add.image(width - 57, STATUS_H / 2, 'icon-hat').setTint(COLORS.saddle);
    this.add
      .rectangle(width - 57, STATUS_H / 2, 62, 62, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Player'));
  }

  // ---------- living diorama ----------

  private buildDiorama(x: number, y: number, w: number, h: number): void {
    // wood frame: ink outline, saddle frame with plank cuts, ink inner line
    const frame = this.add.graphics();
    frame.fillStyle(COLORS.ink);
    frame.fillRect(x - 3, y - 3, w + 6, h + 6);
    frame.fillStyle(COLORS.saddle);
    frame.fillRect(x, y, w, h);
    frame.fillStyle(COLORS.saddleDark);
    for (let px = x + 20; px < x + w - 20; px += 90) {
      frame.fillRect(px, y, 3, 12);
      frame.fillRect(px + 45, y + h - 12, 3, 12);
    }
    frame.fillStyle(COLORS.ink);
    frame.fillRect(x + 12, y + 12, w - 24, h - 24);

    const inX = x + 15;
    const inY = y + 15;
    const inW = w - 30;
    const inH = h - 30;
    const groundY = inY + inH * 0.62;

    const maskG = this.add.graphics().setVisible(false);
    maskG.fillStyle(0xffffff);
    maskG.fillRect(inX, inY, inW, inH);
    const content = this.add.container(0, 0);
    content.setMask(maskG.createGeometryMask());

    const art = this.add.graphics();
    // sky
    art.fillStyle(COLORS.parchmentLight);
    art.fillRect(inX, inY, inW, inH);
    // pixel sun, high and pale
    art.fillStyle(0xf6ead0);
    art.fillRect(inX + inW - 130, inY + 40, 44, 44);
    art.fillRect(inX + inW - 122, inY + 32, 28, 60);
    // distant mesas - the cool counterpoint
    art.fillStyle(COLORS.denim);
    art.fillRect(inX + 30, groundY - 110, 150, 110);
    art.fillRect(inX + 60, groundY - 140, 90, 30);
    art.fillRect(inX + inW - 240, groundY - 80, 190, 80);
    art.fillRect(inX + inW - 200, groundY - 104, 110, 24);
    // haze band where mesas meet the flats
    art.fillStyle(COLORS.parchmentDark);
    art.fillRect(inX, groundY - 8, inW, 8);
    // ground
    art.fillStyle(COLORS.sand);
    art.fillRect(inX, groundY, inW, inY + inH - groundY);
    art.fillStyle(COLORS.saddle, 0.22);
    for (let i = 0; i < 46; i++) {
      art.fillRect(
        inX + Math.random() * (inW - 4),
        groundY + 8 + Math.random() * (inY + inH - groundY - 12),
        3,
        3
      );
    }
    // cacti - sage, passive
    this.drawCactus(art, inX + inW * 0.72, groundY + 34, 1);
    this.drawCactus(art, inX + inW * 0.86, groundY + 78, 1.4);
    this.drawCactus(art, inX + inW * 0.12, groundY + 60, 0.8);
    // fence line
    art.fillStyle(COLORS.saddleDark);
    for (let fx = inX + 20; fx < inX + inW * 0.5; fx += 64) {
      art.fillRect(fx, groundY + 96, 6, 26);
    }
    art.fillRect(inX + 20, groundY + 102, inW * 0.5 - 20, 4);
    content.add(art);

    // lead creature idle-animating in the scene
    const lead =
      SPECIES.find((sp) => sp.id === gameState.data.leadCreatureId) ?? SPECIES[0];
    const leadKey = this.textures.exists(lead.textureKey) ? lead.textureKey : 'pl-unknown';
    const shadow = this.add.rectangle(inX + inW * 0.38, groundY + 64, 96, 8, COLORS.ink, 0.16);
    const critter = this.add.image(inX + inW * 0.38, groundY + 4, leadKey).setScale(2);
    content.add([shadow, critter]);
    this.tweens.add({
      targets: critter,
      y: critter.y - 5,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // drifting dust motes - flat squares, no glow
    this.dioramaTimer = this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const my = groundY - 40 + Math.random() * 90;
        const mote = this.add.rectangle(
          inX + inW + 6,
          my,
          3 + Math.floor(Math.random() * 2) * 2,
          3,
          COLORS.saddle,
          0.35
        );
        content.add(mote);
        this.tweens.add({
          targets: mote,
          x: inX - 10,
          y: my - 12 - Math.random() * 18,
          alpha: 0,
          duration: 4200 + Math.random() * 2400,
          onComplete: () => mote.destroy()
        });
      }
    });

    // caption plate - a little brass-free nameplate for the biome
    const cap = this.add.graphics();
    cap.fillStyle(COLORS.ink);
    cap.fillRect(inX + 10, inY + inH - 46, 216, 38);
    cap.fillStyle(COLORS.saddle);
    cap.fillRect(inX + 12, inY + inH - 44, 212, 34);
    this.add
      .text(inX + 118, inY + inH - 27, gameState.data.biome, {
        fontFamily: FONT.display,
        fontSize: '20px',
        color: HEX.parchment
      })
      .setOrigin(0.5);
  }

  private drawCactus(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
    g.fillStyle(COLORS.sage);
    g.fillRect(x, y - 34 * s, 9 * s, 34 * s);
    g.fillRect(x - 8 * s, y - 26 * s, 8 * s, 5 * s);
    g.fillRect(x - 8 * s, y - 34 * s, 5 * s, 12 * s);
    g.fillRect(x + 9 * s, y - 18 * s, 8 * s, 5 * s);
    g.fillRect(x + 12 * s, y - 26 * s, 5 * s, 12 * s);
  }

  // ---------- CTA + satchel ----------

  private buildExploreCta(cx: number, cy: number): void {
    const w = 440;
    const h = 92;
    const shadow = this.add.rectangle(cx, cy + 5, w, h, COLORS.ink);
    const face = this.add.graphics();
    const drawFace = (offset: number) => {
      face.clear();
      face.fillStyle(COLORS.clay);
      face.fillRect(cx - w / 2, cy - h / 2 + offset, w, h);
      face.fillStyle(COLORS.clayDark);
      face.fillRect(cx - w / 2, cy + h / 2 - 8 + offset, w, 8);
      face.lineStyle(2, COLORS.ink);
      face.strokeRect(cx - w / 2, cy - h / 2 + offset, w, h);
    };
    drawFace(0);
    const label = this.add
      .text(cx, cy - 2, 'EXPLORE', {
        fontFamily: FONT.display,
        fontSize: '40px',
        color: HEX.parchment
      })
      .setOrigin(0.5)
      .setLetterSpacing(3);
    shadow.setDepth(1);
    face.setDepth(2);
    label.setDepth(3);

    this.add
      .rectangle(cx, cy, w, h + 8, 0xffffff, 0)
      .setDepth(4)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        drawFace(4);
        label.y = cy + 2;
      })
      .on('pointerout', () => {
        drawFace(0);
        label.y = cy - 2;
      })
      .on('pointerup', () => {
        drawFace(0);
        label.y = cy - 2;
        this.scene.start('CaptureSelect', { tab: 'tally' });
      });
  }

  private buildSatchel(cx: number, cy: number): void {
    this.add.image(cx, cy, 'icon-satchel').setTint(COLORS.saddle);
    let badge: Phaser.GameObjects.Rectangle | null = null;
    if (gameState.data.dailyAvailable) {
      badge = this.add.rectangle(cx + 20, cy - 20, 10, 10, COLORS.clay);
    }
    this.add
      .rectangle(cx, cy, 70, 70, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openDailyStub(badge));
  }

  private openDailyStub(badge: Phaser.GameObjects.Rectangle | null): void {
    const { width, height } = this.scale;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6).setDepth(60);
    const panel = this.add.graphics().setDepth(61);
    panel.fillStyle(COLORS.ink);
    panel.fillRect(width / 2 - 262, height / 2 - 152, 524, 304);
    panel.fillStyle(COLORS.parchment);
    panel.fillRect(width / 2 - 256, height / 2 - 146, 512, 292);
    const title = this.add
      .text(width / 2, height / 2 - 90, 'DAILY BONUS', {
        fontFamily: FONT.display,
        fontSize: '34px',
        color: HEX.ink
      })
      .setOrigin(0.5)
      .setDepth(62);
    const body = this.add
      .text(width / 2, height / 2 - 10, 'The bonus wheel rolls into town\nin a later update.', {
        fontFamily: FONT.ui,
        fontSize: '17px',
        color: HEX.saddle,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(62);
    const close = this.add
      .rectangle(width / 2, height / 2 + 90, 180, 56, COLORS.saddle)
      .setStrokeStyle(2, COLORS.ink)
      .setDepth(62)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.add
      .text(width / 2, height / 2 + 90, 'CLOSE', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.parchment })
      .setOrigin(0.5)
      .setDepth(63);
    close.on('pointerup', () => {
      [dim, panel, title, body, close, closeTxt].forEach((o) => o.destroy());
      badge?.destroy();
    });
  }
}
