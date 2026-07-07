import Phaser from 'phaser';
import { SPECIES, speciesById, SpeciesDef } from '../data/species';
import { gameState } from '../state/GameState';
import { defenseProfile } from '../data/typeChart';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

/**
 * One page of the Frontier Ledger - the in-world dex. A rancher's record
 * book: each page fills in the more of that species you wrangle.
 *   0 caught: silhouette + ??? only
 *   1+: portrait, name, types, entry notes
 *   2+: weaknesses / resistances
 *   3+: traits (base stats)
 */
export class LedgerScene extends Phaser.Scene {
  private species!: SpeciesDef;

  constructor() {
    super('Ledger');
  }

  init(data: { speciesId: string }): void {
    this.species = speciesById(data.speciesId);
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    const sp = this.species;
    const count = gameState.data.herd.filter((id) => id === sp.id).length;
    const dexNo = SPECIES.indexOf(sp) + 1;

    // top bar
    const bar = this.add.graphics();
    bar.fillStyle(COLORS.parchmentDark);
    bar.fillRect(0, 0, width, 110);
    bar.fillStyle(COLORS.saddle);
    bar.fillRect(0, 106, width, 4);
    makeButton(this, 84, 55, 130, 54, 'BACK', () => this.scene.start('CaptureSelect', { tab: 'tally' }), '18px');
    this.add
      .text(width / 2 + 30, 55, 'FRONTIER LEDGER', { fontFamily: FONT.display, fontSize: '30px', color: HEX.ink })
      .setOrigin(0.5);
    this.add
      .text(width - 30, 55, `#${String(dexNo).padStart(3, '0')}`, {
        fontFamily: FONT.ui,
        fontSize: '22px',
        color: HEX.saddle
      })
      .setOrigin(1, 0.5);

    // the ledger page
    const pgX = 32;
    const pgY = 130;
    const pgW = width - 64;
    const pgH = height - pgY - NAV_HEIGHT - 20;
    const g = this.add.graphics();
    drawPixelPanel(g, pgX, pgY, pgW, pgH, COLORS.parchmentLight, COLORS.saddle);

    // portrait plate
    drawPixelPanel(g, pgX + 24, pgY + 24, 184, 184, COLORS.parchment, COLORS.saddleDark, 4);
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const portrait = this.add.image(pgX + 116, pgY + 116, texKey).setScale(1.7);
    if (count === 0) portrait.setTintFill(COLORS.ink).setAlpha(0.85);

    // name, types, tally
    const nx = pgX + 238;
    this.add.text(nx, pgY + 28, count > 0 ? sp.name.toUpperCase() : '???', {
      fontFamily: FONT.display,
      fontSize: '34px',
      color: HEX.ink
    });
    if (count > 0) {
      let chipX = nx;
      for (const t of [sp.type1, sp.type2]) {
        if (!t) continue;
        chipX += this.makeTypeChip(chipX, pgY + 88, t) + 12;
      }
    } else {
      this.add.text(nx, pgY + 92, 'TYPE UNKNOWN', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage });
    }
    this.add.text(nx, pgY + 148, 'WRANGLED', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle });
    this.drawTally(g, nx, pgY + 176, count);

    // ruled sections, revealed by capture count
    const entry =
      sp.blurb && sp.blurb.length > 0
        ? sp.blurb
        : `The rancher's notes on ${sp.name} are sparse. More study needed out on the range.`;
    const prof = defenseProfile(sp.type1, sp.type2);
    const weakLine = prof.weak.length > 0 ? prof.weak.join(' / ') : 'None recorded';
    let resistLine = prof.resist.length > 0 ? prof.resist.join(' / ') : 'None recorded';
    if (prof.immune.length > 0) resistLine += `   IMMUNE: ${prof.immune.join(' / ')}`;
    const stat = (v?: number) => (v === undefined ? '--' : `${v}`);
    const statsLine = `HP ${stat(sp.hp)}   ATK ${stat(sp.attack)}   DEF ${stat(sp.defense)}   SPA ${stat(sp.spAttack)}   SPD ${stat(sp.spDefense)}   SPE ${stat(sp.speed)}`;

    this.section(g, pgX, pgY + 236, pgW, 'ENTRY', count >= 1, count, 1, [entry]);
    this.section(g, pgX, pgY + 396, pgW, 'WEAKNESSES + RESISTANCES', count >= 2, count, 2, [
      `WEAK: ${weakLine}`,
      `RESIST: ${resistLine}`
    ]);
    this.section(g, pgX, pgY + 546, pgW, 'TRAITS', count >= 3, count, 3, [statsLine]);

    // temporary testing entry point into the capture mini-game
    makeButton(this, width / 2, pgY + pgH - 64, 340, 70, 'TEST WRANGLE', () =>
      this.scene.start('Capture', { speciesId: sp.id })
    , '20px');

    buildNav(this, 'collection');
  }

  /** Type chip: flat parchment tag with saddle frame. Returns chip width. */
  private makeTypeChip(x: number, y: number, label: string): number {
    const txt = this.add
      .text(0, 0, label.toUpperCase(), { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink })
      .setOrigin(0, 0.5);
    const w = txt.width + 28;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink);
    g.fillRect(x - 2, y - 2, w + 4, 40);
    g.fillStyle(COLORS.parchmentDark);
    g.fillRect(x, y, w, 36);
    txt.setPosition(x + 14, y + 18);
    return w;
  }

  /** Capture count as ledger tally marks (groups of five). */
  private drawTally(g: Phaser.GameObjects.Graphics, x: number, y: number, count: number): void {
    const shown = Math.min(count, 15);
    g.lineStyle(3, COLORS.ink);
    let cx = x;
    for (let i = 0; i < shown; i++) {
      const inGroup = i % 5;
      if (inGroup < 4) {
        g.lineBetween(cx + inGroup * 9, y, cx + inGroup * 9, y + 26);
      } else {
        g.lineBetween(cx - 5, y + 22, cx + 32, y + 2); // the diagonal fifth
        cx += 52;
      }
    }
    this.add
      .text(x + 220, y + 13, `${count}`, { fontFamily: FONT.ui, fontSize: '22px', color: HEX.ink })
      .setOrigin(0, 0.5);
  }

  private section(
    g: Phaser.GameObjects.Graphics,
    pgX: number,
    y: number,
    pgW: number,
    title: string,
    unlocked: boolean,
    count: number,
    needed: number,
    lines: string[]
  ): void {
    g.fillStyle(COLORS.saddle);
    g.fillRect(pgX + 24, y, pgW - 48, 2);
    this.add.text(pgX + 24, y + 12, title, { fontFamily: FONT.ui, fontSize: '17px', color: HEX.saddle });
    if (unlocked) {
      lines.forEach((line, i) => {
        this.add.text(pgX + 24, y + 48 + i * 40, line, {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.ink,
          wordWrap: { width: pgW - 60 }
        });
      });
    } else {
      const more = needed - count;
      this.add.text(pgX + 24, y + 48, `RECORD INCOMPLETE - WRANGLE ${more} MORE`, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      });
    }
  }
}
