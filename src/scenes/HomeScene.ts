import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { gameState, xpForNextLevel } from '../state/GameState';
import { dateKey } from '../util/daily';
import { movesForSpecies } from '../battle/moves';
import { playMusic } from '../audio/audio';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { addGoldCounter } from '../ui/goldCounter';
import { openPossePicker } from '../ui/possePicker';
import { buildNav } from '../ui/nav';
import {
  drawFrontierBackdrop,
  drawFrontierForeground,
  drawSky,
  seenSpecies,
  skyLook,
  WalkerTroupe
} from '../ui/vignette';

// same height as the Critters + Daily top bars so screens line up
const STATUS_H = 110;
const CARD_W = 560;
const CARD_H = 190;
const CARD_SPACING = 600;

/**
 * Home: quiet status bar, the living diorama (signature element), one clay
 * Explore CTA, a tucked satchel for the daily bonus, persistent nav.
 * Nothing competes for attention on load.
 */
export class HomeScene extends Phaser.Scene {
  private dioramaTimer?: Phaser.Time.TimerEvent;
  private carousel!: Phaser.GameObjects.Container;
  private cardBorders: Phaser.GameObjects.Rectangle[] = [];
  private activeTags: Phaser.GameObjects.Text[] = [];
  private dots: Phaser.GameObjects.Rectangle[] = [];
  private page = 0;
  private carDrag?: { startX: number; baseX: number; moved: number };
  private staminaCont?: Phaser.GameObjects.Container;

  constructor() {
    super('Home');
  }

  create(): void {
    ensureIcons(this);
    gameState.refreshStamina();
    playMusic('home');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.cardBorders = [];
    this.activeTags = [];
    this.dots = [];
    this.carDrag = undefined;

    this.buildStatusBar();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.drawStamina() });
    this.buildPlayerRow(STATUS_H + 28);

    // living diorama, sized to leave room for the posse carousel + CTA
    const dioY = STATUS_H + 62;
    const dioH = Phaser.Math.Clamp(height - 840, 300, 560);
    this.buildDiorama(32, dioY, width - 64, dioH);

    // quick-select posse carousel between the diorama and the CTA
    const cardCy = dioY + dioH + 24 + CARD_H / 2;
    this.buildTeamCarousel(cardCy);

    const ctaY = cardCy + CARD_H / 2 + 96;
    this.buildExploreCta(width / 2, ctaY);
    this.buildSatchel(width / 2, ctaY + 96);

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

    this.drawStamina();

    // GOLD, top right - brass, and only brass
    addGoldCounter(this, STATUS_H / 2);
  }

  /**
   * Stamina horseshoes, redrawn every second: spent shoes are faded, the
   * one currently refilling fills bottom-up over the hour, and a countdown
   * to the next point sits right of the tally.
   */
  private drawStamina(): void {
    gameState.refreshStamina();
    this.staminaCont?.destroy();
    const c = this.add.container(0, 0);
    this.staminaCont = c;
    const d = gameState.data;
    const HOUR = 3600000;
    const cy = STATUS_H / 2;
    const filling = d.stamina < d.staminaMax;
    const frac = filling ? Phaser.Math.Clamp((Date.now() - d.staminaUpdatedAt) / HOUR, 0, 1) : 0;
    for (let i = 0; i < d.staminaMax; i++) {
      const x = 44 + i * 52;
      if (i < d.stamina) {
        c.add(this.add.image(x, cy, 'icon-horseshoe').setTint(COLORS.sage));
      } else {
        c.add(this.add.image(x, cy, 'icon-horseshoe').setTint(COLORS.saddle).setAlpha(0.3));
        if (i === d.stamina && frac > 0) {
          const fillPx = Math.round(44 * frac);
          const over = this.add.image(x, cy, 'icon-horseshoe').setTint(COLORS.sage);
          over.setCrop(0, 44 - fillPx, 44, fillPx);
          c.add(over);
        }
      }
    }
    const tx = 44 + (d.staminaMax - 1) * 52 + 36;
    c.add(
      this.add
        .text(tx, cy, `${d.stamina}/${d.staminaMax}`, { fontFamily: FONT.ui, fontSize: '32px', color: HEX.sage })
        .setOrigin(0, 0.5)
    );
    if (filling) {
      const s = Math.ceil(Math.max(0, HOUR - (Date.now() - d.staminaUpdatedAt)) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      c.add(
        this.add
          .text(tx + 92, cy, `+1 IN ${pad(Math.floor(s / 60))}:${pad(s % 60)}`, {
            fontFamily: FONT.ui,
            fontSize: '18px',
            color: HEX.sage
          })
          .setOrigin(0, 0.5)
      );
    }
  }

  /** Name + LV + XP bar on one line under the status bar; tap for profile. */
  private buildPlayerRow(cy: number): void {
    const { width } = this.scale;
    const name = this.add
      .text(30, cy, gameState.data.playerName, { fontFamily: FONT.display, fontSize: '22px', color: HEX.ink })
      .setOrigin(0, 0.5);
    const lv = this.add
      .text(30 + name.width + 18, cy, `LV ${gameState.data.playerLevel}`, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.saddle
      })
      .setOrigin(0, 0.5);

    const bx = 30 + name.width + 18 + lv.width + 18;
    const bw = width - 30 - bx;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink);
    g.fillRect(bx - 2, cy - 10, bw + 4, 20);
    g.fillStyle(COLORS.ashGray);
    g.fillRect(bx, cy - 8, bw, 16);
    const frac = Phaser.Math.Clamp(gameState.data.playerXp / xpForNextLevel(gameState.data.playerLevel), 0, 1);
    if (frac > 0) {
      g.fillStyle(COLORS.denim);
      g.fillRect(bx, cy - 8, Math.round(bw * frac), 16);
    }

    this.add
      .rectangle(width / 2, cy, width, 40, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Player'));
  }

  // ---------- living diorama ----------

  /**
   * The home vista: a Frontier Flats interpretation of the last map region
   * ridden, lit by the player's REAL local time (shared vignette toolkit -
   * dawn/day/dusk/dark-moon skies), with the two featured critters
   * wandering the flats on depth lanes, hopping and chatting in pixel
   * emotion bubbles. Display picks come from the Player profile.
   */
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
    const horizonY = inY + Math.round(inH * 0.5);
    const bottomY = inY + inH;

    const maskG = this.add.graphics().setVisible(false);
    maskG.fillStyle(0xffffff);
    maskG.fillRect(inX, inY, inW, inH);
    const content = this.add.container(0, 0);
    content.setMask(maskG.createGeometryMask());

    // sky + skyline + flats, then the two walker depth lanes around the
    // mid-ground props (back lane walks BEHIND the cacti/fence, smaller)
    const look = skyLook();
    const art = this.add.graphics();
    drawSky(art, inX, inY, inW, horizonY, look);
    drawFrontierBackdrop(art, inX, inW, horizonY, bottomY, look);
    content.add(art);
    const backLayer = this.add.container(0, 0);
    content.add(backLayer);
    const midG = this.add.graphics();
    drawFrontierForeground(midG, inX, inW, horizonY, bottomY, look);
    content.add(midG);
    const frontLayer = this.add.container(0, 0);
    content.add(frontLayer);

    new WalkerTroupe(this, this.displayPair(), {
      left: inX + 10,
      right: inX + inW - 10,
      frontY: bottomY - 24,
      backY: horizonY + 20,
      frontSize: 88,
      backSize: 54,
      frontLayer,
      backLayer,
      interact: true
    });

    // drifting dust motes - flat squares, no glow
    this.dioramaTimer = this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const my = horizonY - 30 + Math.random() * 90;
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

    // caption plate - names the region this vista interprets
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

  /**
   * Up to 2 species for the diorama: the profile's display picks first,
   * random seen species filling any empty slot.
   */
  private displayPair(): SpeciesDef[] {
    const out: SpeciesDef[] = [];
    for (const uid of gameState.data.displayCritters) {
      if (!uid) continue;
      const inst = gameState.data.herd.find((c) => c.uid === uid);
      const sp = inst ? SPECIES.find((s) => s.id === inst.speciesId) : undefined;
      if (sp) out.push(sp);
    }
    const pool = seenSpecies().filter((sp) => !out.includes(sp));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    while (out.length < 2 && pool.length > 0) {
      const sp = pool.pop();
      if (sp) out.push(sp);
    }
    return out.slice(0, 2);
  }

  // ---------- posse quick-select carousel ----------

  private buildTeamCarousel(cy: number): void {
    const { width } = this.scale;
    const teams = gameState.data.teams;

    this.carousel = this.add.container(0, 0);
    teams.forEach((team, i) => this.buildTeamCard(team, i, width / 2 + i * CARD_SPACING, cy));

    this.page = Phaser.Math.Clamp(gameState.data.activeTeam, 0, teams.length - 1);
    this.carousel.x = -this.page * CARD_SPACING;

    // page dots - flat squares
    const dotsY = cy + CARD_H / 2 + 22;
    teams.forEach((_, i) => {
      const dot = this.add.rectangle(width / 2 + (i - (teams.length - 1) / 2) * 30, dotsY, 11, 11, COLORS.parchmentDark);
      this.dots.push(dot);
    });
    this.updateCarouselUi();

    // drag with rubber-banding at the ends, snap with an eased tween
    const bandTop = cy - CARD_H / 2 - 8;
    const bandBottom = cy + CARD_H / 2 + 8;
    const minX = -(teams.length - 1) * CARD_SPACING;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < bandTop || p.y > bandBottom) return;
      this.tweens.killTweensOf(this.carousel);
      this.carDrag = { startX: p.x, baseX: this.carousel.x, moved: 0 };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.carDrag || !p.isDown) return;
      const dx = p.x - this.carDrag.startX;
      this.carDrag.moved = Math.max(this.carDrag.moved, Math.abs(dx));
      let nx = this.carDrag.baseX + dx;
      if (nx > 0) nx *= 0.35;
      if (nx < minX) nx = minX + (nx - minX) * 0.35;
      this.carousel.x = nx;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.carDrag) return;
      const dx = p.x - this.carDrag.startX;
      const tapped = this.carDrag.moved < 10;
      this.carDrag = undefined;
      if (tapped) {
        // tapping the visible card selects that posse
        gameState.data.activeTeam = this.page;
        gameState.save();
      } else if (dx < -60) {
        this.page++;
      } else if (dx > 60) {
        this.page--;
      } else {
        this.page = Math.round(-this.carousel.x / CARD_SPACING);
      }
      this.page = Phaser.Math.Clamp(this.page, 0, teams.length - 1);
      this.tweens.add({
        targets: this.carousel,
        x: -this.page * CARD_SPACING,
        duration: 300,
        ease: 'Cubic.easeOut'
      });
      this.updateCarouselUi();
    });
  }

  private buildTeamCard(team: { name: string; members: (string | null)[] }, index: number, x: number, cy: number): void {
    const g = this.add.graphics();
    drawPixelPanel(g, x - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, COLORS.parchmentLight, COLORS.saddle);
    this.carousel.add(g);

    const nameT = this.add.text(x - CARD_W / 2 + 18, cy - CARD_H / 2 + 14, team.name, {
      fontFamily: FONT.display,
      fontSize: '22px',
      color: HEX.ink
    });
    this.carousel.add(nameT);

    // three slots (critter uids) centered as a row within the card, with
    // level + move-type dots stacked under each. Tap a filled slot to open
    // that critter's page; long-press to change/clear.
    for (let s = 0; s < 3; s++) {
      const sx = x + (s - 1) * 140;
      const slotCy = cy - 20;
      const slot = this.add.rectangle(sx, slotCy, 80, 80, COLORS.parchmentDark).setStrokeStyle(3, COLORS.saddle);
      this.carousel.add(slot);
      const memberUid = team.members[s];
      const inst = memberUid ? gameState.data.herd.find((c) => c.uid === memberUid) : undefined;
      if (inst) {
        const sp = SPECIES.find((c) => c.id === inst.speciesId);
        const texKey = sp && this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
        const img = this.add.image(sx, slotCy, texKey).setDisplaySize(68, 68);
        this.carousel.add(img);
        const lv = this.add
          .text(sx, cy + 32, `LV ${inst.level}`, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle })
          .setOrigin(0.5);
        this.carousel.add(lv);
        if (sp) {
          const moves = movesForSpecies(sp);
          moves.forEach((mv, i) => {
            const key = this.textures.exists(`typedot-${mv.type}`) ? `typedot-${mv.type}` : 'typedot-Normal';
            const dot = this.add.image(sx + (i - (moves.length - 1) / 2) * 46, cy + 60, key).setScale(2);
            this.carousel.add(dot);
          });
        }
      } else {
        const plus = this.add
          .text(sx, slotCy, '+', { fontFamily: FONT.display, fontSize: '34px', color: HEX.saddle })
          .setOrigin(0.5);
        this.carousel.add(plus);
      }

      const openPicker = () => openPossePicker(this, index, s, () => this.scene.restart());
      let pressTimer: Phaser.Time.TimerEvent | undefined;
      let longFired = false;
      slot
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          longFired = false;
          pressTimer = this.time.delayedCall(450, () => {
            if (this.carDrag && this.carDrag.moved >= 10) return;
            longFired = true;
            openPicker();
          });
        })
        .on('pointerout', () => pressTimer?.remove())
        .on('pointerup', () => {
          pressTimer?.remove();
          if (longFired) return;
          if (this.carDrag && this.carDrag.moved >= 10) return;
          if (inst) {
            this.scene.start('Critter', { uid: inst.uid, from: 'home' });
            return;
          }
          openPicker();
        });
    }

    // selection: clay border + ACTIVE tag (clay is the actionable accent)
    const border = this.add
      .rectangle(x, cy, CARD_W + 12, CARD_H + 12)
      .setStrokeStyle(6, COLORS.clay)
      .setVisible(index === gameState.data.activeTeam);
    this.carousel.add(border);
    this.cardBorders.push(border);
    const tag = this.add
      .text(x + CARD_W / 2 - 16, cy - CARD_H / 2 + 16, 'ACTIVE', {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.clay
      })
      .setOrigin(1, 0)
      .setVisible(index === gameState.data.activeTeam);
    this.carousel.add(tag);
    this.activeTags.push(tag);
  }

  private updateCarouselUi(): void {
    const active = gameState.data.activeTeam;
    this.cardBorders.forEach((b, i) => b.setVisible(i === active));
    this.activeTags.forEach((t, i) => t.setVisible(i === active));
    this.dots.forEach((d, i) => {
      if (i === active) {
        d.setFillStyle(COLORS.clay).setStrokeStyle(0, 0);
      } else if (i === this.page) {
        d.setFillStyle(COLORS.saddle).setStrokeStyle(0, 0);
      } else {
        d.setFillStyle(COLORS.parchmentDark).setStrokeStyle(2, COLORS.saddle);
      }
    });
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
        this.scene.start('Map');
      });
  }

  private buildSatchel(cx: number, cy: number): void {
    this.add.image(cx, cy, 'icon-satchel').setTint(COLORS.saddle);
    const d = gameState.data.daily;
    const today = dateKey();
    if (d.lastPunch !== today || d.lastSpin !== today) {
      this.add.rectangle(cx + 20, cy - 20, 10, 10, COLORS.clay);
    }
    this.add
      .rectangle(cx, cy, 70, 70, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Daily'));
  }
}
