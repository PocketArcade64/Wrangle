import Phaser from 'phaser';
import { SPECIES, speciesById, SpeciesDef } from '../data/species';
import { gameState } from '../state/GameState';
import { DefenseProfile, defenseProfile } from '../data/typeChart';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { addTypeBadge } from '../ui/typeBadge';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

/**
 * One page of the Frontier Ledger - the in-world dex. A rancher's record
 * book: each page fills in the more of that species you wrangle.
 *   0 caught: silhouette + ??? only
 *   1+: portrait, name, types, entry notes, where to find (placeholder)
 *   2+: weaknesses / resistances (rendered with the type badge art)
 *   3+: base stats
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
    const count = gameState.data.herd.filter((c) => c.speciesId === sp.id).length;
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

    // portrait plate - seen reveals the sprite and name, dex-style
    const seenN = gameState.data.seen[sp.id] ?? 0;
    const revealed = count > 0 || seenN > 0;
    drawPixelPanel(g, pgX + 24, pgY + 24, 184, 184, COLORS.parchment, COLORS.saddleDark, 4);
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const portrait = this.add.image(pgX + 116, pgY + 116, texKey).setScale(1.7);
    if (!revealed) portrait.setTintFill(COLORS.ink).setAlpha(0.85);

    // name, types, seen/wrangled record
    const nx = pgX + 238;
    this.add.text(nx, pgY + 28, revealed ? sp.name.toUpperCase() : '???', {
      fontFamily: FONT.display,
      fontSize: '34px',
      color: HEX.ink
    });
    if (count > 0) {
      const types = [sp.type1, sp.type2].filter((t): t is string => !!t);
      types.forEach((t, i) => addTypeBadge(this, nx + 69 + i * 152, pgY + 100, t, 3));
    } else {
      this.add.text(nx, pgY + 92, 'TYPE UNKNOWN', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage });
    }
    // field record: SEEN and WRANGLED side by side
    this.recordBlock(g, nx, pgY + 136, 'SEEN', seenN);
    this.recordBlock(g, nx + 200, pgY + 136, 'WRANGLED', count);

    // ruled sections, revealed by capture count
    const entry =
      sp.blurb && sp.blurb.length > 0
        ? sp.blurb
        : `The rancher's notes on ${sp.name} are sparse. More study needed out on the range.`;
    const prof = defenseProfile(sp.type1, sp.type2);
    const stat = (v?: number) => (v === undefined ? '--' : `${v}`);
    const statsLine = `HP ${stat(sp.hp)}   ATK ${stat(sp.attack)}   DEF ${stat(sp.defense)}   SPA ${stat(sp.spAttack)}   SPD ${stat(sp.spDefense)}   SPE ${stat(sp.speed)}`;

    let cy = pgY + 236;
    this.section(g, pgX, cy, pgW, 'ENTRY', count >= 1, count, 1, [entry]);
    cy += 150;
    cy = this.matchupSection(g, pgX, cy, pgW, count >= 2, count, prof);
    this.section(g, pgX, cy, pgW, 'BASE STATS', count >= 3, count, 3, [statsLine]);
    cy += 108;
    this.section(g, pgX, cy, pgW, 'WHERE TO FIND', count >= 1, count, 1, [
      'Range unknown. Habitat notes will be inked in once the frontier map is charted.'
    ]);

    // temporary testing entry point into the capture mini-game
    makeButton(this, width / 2, pgY + pgH - 64, 340, 70, 'TEST WRANGLE', () =>
      this.scene.start('Capture', { speciesId: sp.id })
    , '20px');

    buildNav(this, 'collection');
  }

  /** Field-record stat: small label over a big number in a framed socket. */
  private recordBlock(g: Phaser.GameObjects.Graphics, x: number, y: number, label: string, value: number): void {
    drawPixelPanel(g, x, y, 180, 74, COLORS.parchment, COLORS.saddleDark, 3);
    this.add
      .text(x + 90, y + 18, label, { fontFamily: FONT.ui, fontSize: '15px', color: HEX.saddle })
      .setOrigin(0.5);
    this.add
      .text(x + 90, y + 48, `${value}`, { fontFamily: FONT.ui, fontSize: '26px', color: HEX.ink })
      .setOrigin(0.5);
  }

  /**
   * WEAKNESSES + RESISTANCES rendered with the user's type badge art (x4
   * marks kept as text). Rows wrap when a type list runs long, so this
   * section is variable-height: returns the y where the next section starts.
   */
  private matchupSection(
    g: Phaser.GameObjects.Graphics,
    pgX: number,
    y: number,
    pgW: number,
    unlocked: boolean,
    count: number,
    prof: DefenseProfile
  ): number {
    g.fillStyle(COLORS.saddle);
    g.fillRect(pgX + 24, y, pgW - 48, 2);
    this.add.text(pgX + 24, y + 12, 'WEAKNESSES + RESISTANCES', {
      fontFamily: FONT.ui,
      fontSize: '17px',
      color: HEX.saddle
    });
    if (!unlocked) {
      this.add.text(pgX + 24, y + 48, `RECORD INCOMPLETE - WRANGLE ${2 - count} MORE`, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      });
      return y + 108;
    }
    const x0 = pgX + 120;
    const maxX = pgX + pgW - 24;
    let rowY = this.matchupRow(pgX, x0, maxX, y + 70, 'WEAK', prof.weak);
    rowY = this.matchupRow(pgX, x0, maxX, rowY + 48, 'RESIST', prof.resist);
    if (prof.immune.length > 0) {
      rowY = this.matchupRow(pgX, x0, maxX, rowY + 48, 'IMMUNE', prof.immune);
    }
    return rowY + 52;
  }

  /**
   * One labeled row of type badges (entries are chart names, optionally
   * suffixed like "Fire x4"); wraps past maxX. Returns the last row's y.
   */
  private matchupRow(
    pgX: number,
    x0: number,
    maxX: number,
    rowY: number,
    label: string,
    entries: string[]
  ): number {
    this.add
      .text(pgX + 24, rowY, label, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.sage })
      .setOrigin(0, 0.5);
    if (entries.length === 0) {
      this.add
        .text(x0, rowY, 'NONE RECORDED', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink })
        .setOrigin(0, 0.5);
      return rowY;
    }
    let x = x0;
    for (const e of entries) {
      const [type, mark] = e.split(' ');
      const w = mark ? 138 : 100; // badge is 92px at x2, plus the x4 tag
      if (x + w - 8 > maxX) {
        x = x0;
        rowY += 44;
      }
      addTypeBadge(this, x + 46, rowY, type, 2);
      if (mark) {
        this.add
          .text(x + 96, rowY, mark.toUpperCase(), { fontFamily: FONT.ui, fontSize: '16px', color: HEX.ink })
          .setOrigin(0, 0.5);
      }
      x += w;
    }
    return rowY;
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
