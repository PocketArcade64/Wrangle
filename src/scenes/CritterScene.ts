import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { badgeName } from '../data/typeChart';
import { CritterInstance, gameState, xpForNextLevel } from '../state/GameState';
import { releaseCritters } from '../state/herdOps';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { confirmDialog } from '../ui/confirm';
import { addTypeBadge } from '../ui/typeBadge';
import { buildNav, NAV_HEIGHT } from '../ui/nav';

const STAT_LABELS: [keyof CritterInstance['pedigree'], string][] = [
  ['hp', 'HP'],
  ['atk', 'ATK'],
  ['def', 'DEF'],
  ['spa', 'SPA'],
  ['spd', 'SPD'],
  ['spe', 'SPE']
];
// hex radar vertices clockwise from the top: HP / ATK / DEF / SPE / SPD / SPA
const HEX_STAT_LABELS: [keyof CritterInstance['pedigree'], string][] = [
  ['hp', 'HP'],
  ['atk', 'ATK'],
  ['def', 'DEF'],
  ['spe', 'SPE'],
  ['spd', 'SPD'],
  ['spa', 'SPA']
];
// CSV base stats are blank until balancing - show a provisional 50
const PROVISIONAL_BASE = 50;
const STAT_SCALE_MAX = 165; // display ceiling: strong base 150 + pedigree 15

type ChartTab = 'stats' | 'base' | 'pedigree';
type ChartView = 'bars' | 'hex';

const CHART_TABS: { tab: ChartTab; label: string }[] = [
  { tab: 'stats', label: 'STATS' },
  { tab: 'base', label: 'BASE STATS' },
  { tab: 'pedigree', label: 'PEDIGREE' }
];

/** Pedigree reads best as a radar; the stat tabs default to bars. */
const DEFAULT_VIEW: Record<ChartTab, ChartView> = { stats: 'bars', base: 'bars', pedigree: 'hex' };

const CHART_TITLE: Record<ChartTab, string> = {
  stats: 'STATS',
  base: 'BASE STATS',
  pedigree: 'PEDIGREE (MAX 15)'
};

/**
 * One specific critter from your herd (Pokemon GO-style page, frontier
 * flavored): portrait on a scenic band, types, attacker style, current
 * moves, and a three-tab stat view - STATS (base + pedigree), BASE STATS
 * (base only) and PEDIGREE (bloodline bonus, 0-15 scale) - each of which
 * can be toggled between horizontal bars and a hex radar.
 */
export class CritterScene extends Phaser.Scene {
  private critter!: CritterInstance;
  private species!: SpeciesDef;
  private chartTab: ChartTab = 'stats';
  private chartView: ChartView = 'bars';
  /** 'home' when opened from the home carousel - BACK returns there. */
  private from?: 'home';
  private favStar!: Phaser.GameObjects.Image;
  private tempMsg?: Phaser.GameObjects.Text;

  constructor() {
    super('Critter');
  }

  init(data: { uid: string; chart?: ChartTab; view?: ChartView; from?: 'home' }): void {
    const found = gameState.data.herd.find((c) => c.uid === data.uid);
    if (!found) {
      this.scene.start('CaptureSelect', { tab: 'herd' });
      return;
    }
    this.critter = found;
    this.species = SPECIES.find((s) => s.id === found.speciesId) ?? SPECIES[0];
    this.chartTab = data.chart ?? 'stats';
    this.chartView = data.view ?? DEFAULT_VIEW[this.chartTab];
    this.from = data.from;
  }

  /** Where BACK (and post-release) goes: wherever this page was opened from. */
  private exitScene(): void {
    if (this.from === 'home') this.scene.start('Home');
    else this.scene.start('CaptureSelect', { tab: 'herd' });
  }

  create(): void {
    if (!this.critter) return;
    ensureIcons(this);
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    const sp = this.species;

    // scenic hero band
    const g = this.add.graphics();
    g.fillStyle(COLORS.parchmentLight);
    g.fillRect(0, 0, width, 330);
    g.fillStyle(COLORS.sand);
    g.fillRect(0, 262, width, 68);
    g.fillStyle(COLORS.saddle, 0.22);
    for (let i = 0; i < 26; i++) {
      g.fillRect(20 + Math.random() * (width - 40), 272 + Math.random() * 50, 3, 3);
    }
    g.fillStyle(COLORS.ink, 0.14);
    g.fillRect(width / 2 - 62, 288, 124, 8);
    const texKey = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    // every critter renders at the same fixed portrait size (source PNGs
    // vary), feet grounded on the shadow, with a gentle idle bob
    const sprite = this.add.image(width / 2, 186, texKey).setDisplaySize(224, 224);
    this.tweens.add({
      targets: sprite,
      y: 178,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // same spot as the ledger page's BACK so it doesn't jump between scenes
    makeButton(this, 84, 55, 130, 54, 'BACK', () => this.exitScene(), '18px');

    // favorite: clay = active state. Favorites can't be released, turned in
    // for bounties, or auctioned.
    this.favStar = this.add.image(width - 56, 52, 'icon-star').setScale(1.1);
    this.paintFavStar();
    this.favStar.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.critter.favorite = !this.critter.favorite;
      gameState.save();
      this.paintFavStar();
    });

    // icon rail below the favorite star: ledger page, turn loose, type chart
    this.add
      .image(width - 56, 122, 'icon-ledger')
      .setTint(COLORS.saddle)
      .setScale(1.1)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () =>
        this.scene.start('Ledger', {
          speciesId: this.species.id,
          fromUid: this.critter.uid,
          critterFrom: this.from
        })
      );
    this.add
      .image(width - 56, 192, 'icon-gate')
      .setTint(COLORS.saddle)
      .setScale(1.1)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tryRelease());
    this.add
      .image(width - 56, 262, 'icon-chart')
      .setTint(COLORS.saddle)
      .setScale(1.1)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () =>
        this.scene.start('TypeChart', {
          back: { scene: 'Critter', data: { uid: this.critter.uid, from: this.from } },
          highlight: [this.species.type1, this.species.type2]
            .filter((t): t is string => !!t)
            .map(badgeName)
        })
      );

    this.add
      .text(width / 2, 366, sp.name.toUpperCase(), { fontFamily: FONT.display, fontSize: '38px', color: HEX.ink })
      .setOrigin(0.5);

    // type badges, centered as a group
    const types = [sp.type1, sp.type2].filter((t): t is string => !!t);
    types.forEach((t, i) => {
      const bx = width / 2 + (i - (types.length - 1) / 2) * 160;
      addTypeBadge(this, bx, 420, t, 3);
    });

    const style =
      sp.atkStyle === 'physical' ? 'PHYSICAL ATTACKER' : sp.atkStyle === 'special' ? 'SPECIAL ATTACKER' : 'STYLE UNKNOWN';
    this.add
      .text(width / 2, 466, style, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
      .setOrigin(0.5);

    this.buildLevelXp(508);
    this.buildMoves(594);
    this.buildChartTabs(778);
    if (this.chartView === 'bars') this.buildBars(816);
    else this.buildHexChart(816);

    buildNav(this, 'collection');
  }

  /**
   * Big branding-iron level number flanked by poster rules, over a full-
   * width XP meter: wood frame with corner rivets, ash-gray empty track,
   * denim fill, quarter notches.
   */
  private buildLevelXp(y: number): void {
    const { width } = this.scale;
    const lv = this.add
      .text(width / 2, y, `LV. ${this.critter.level}`, {
        fontFamily: FONT.display,
        fontSize: '40px',
        color: HEX.ink
      })
      .setOrigin(0.5);

    const g = this.add.graphics();
    // ornamental side rules with square nubs, like a poster divider
    g.fillStyle(COLORS.saddle);
    const ruleW = 90;
    const gap = lv.width / 2 + 26;
    g.fillRect(width / 2 - gap - ruleW, y - 2, ruleW, 4);
    g.fillRect(width / 2 + gap, y - 2, ruleW, 4);
    g.fillRect(width / 2 - gap - 8, y - 5, 10, 10);
    g.fillRect(width / 2 + gap - 2, y - 5, 10, 10);

    const need = xpForNextLevel(this.critter.level);
    this.add
      .text(width - 42, y + 34, `${this.critter.xp} / ${need} XP`, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.saddle
      })
      .setOrigin(1, 1);

    // XP meter
    const bx = 40;
    const bw = width - 80;
    const by = y + 40;
    const bh = 30;
    g.fillStyle(COLORS.ink);
    g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.fillStyle(COLORS.saddle);
    g.fillRect(bx, by, bw, bh);
    const ix = bx + 5;
    const iy = by + 5;
    const iw = bw - 10;
    const ih = bh - 10;
    g.fillStyle(COLORS.ashGray);
    g.fillRect(ix, iy, iw, ih);
    const frac = Phaser.Math.Clamp(this.critter.xp / need, 0, 1);
    if (frac > 0) {
      g.fillStyle(COLORS.denim);
      g.fillRect(ix, iy, Math.round(iw * frac), ih);
    }
    g.fillStyle(COLORS.ink, 0.25);
    for (const q of [0.25, 0.5, 0.75]) {
      g.fillRect(ix + Math.round(iw * q) - 1, iy, 2, ih);
    }
    g.fillStyle(COLORS.saddleDark);
    g.fillRect(bx + 2, by + 2, 4, 4);
    g.fillRect(bx + bw - 6, by + 2, 4, 4);
    g.fillRect(bx + 2, by + bh - 6, 4, 4);
    g.fillRect(bx + bw - 6, by + bh - 6, 4, 4);
  }

  private paintFavStar(): void {
    if (this.critter.favorite) this.favStar.setTint(COLORS.clay).setAlpha(1);
    else this.favStar.setTint(COLORS.saddle).setAlpha(0.45);
  }

  // ---------- moves (placeholder until the battle system lands in M3) ----------

  private buildMoves(y: number): void {
    const { width } = this.scale;
    const sp = this.species;
    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 148, COLORS.parchmentLight, COLORS.saddle);
    this.add.text(64, y + 14, 'CURRENT MOVES', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle });

    const word1 = sp.atkStyle === 'special' ? 'HEX' : 'STRIKE';
    const word2 = sp.atkStyle === 'special' ? 'SURGE' : 'RUSH';
    const t1 = sp.type1 ?? 'Normal';
    const t2 = sp.type2 ?? t1;
    const moves: [string, string][] = [
      [t1, `${badgeName(t1).toUpperCase()} ${word1}`],
      [t2, `${badgeName(t2).toUpperCase()} ${word2}`]
    ];
    moves.forEach(([type, name], i) => {
      const my = y + 58 + i * 44;
      addTypeBadge(this, 118, my, type, 2);
      this.add
        .text(188, my, name, { fontFamily: FONT.ui, fontSize: '20px', color: HEX.ink })
        .setOrigin(0, 0.5);
    });
  }

  // ---------- stat charts ----------

  private statTotal(key: keyof CritterInstance['pedigree']): { base: number; ped: number } {
    const sp = this.species;
    const baseMap: Record<string, number | undefined> = {
      hp: sp.hp,
      atk: sp.attack,
      def: sp.defense,
      spa: sp.spAttack,
      spd: sp.spDefense,
      spe: sp.speed
    };
    return { base: baseMap[key] ?? PROVISIONAL_BASE, ped: this.critter.pedigree[key] };
  }

  private buildChartTabs(y: number): void {
    const { width } = this.scale;
    CHART_TABS.forEach(({ tab, label }, i) => {
      const x = width / 2 + (i - (CHART_TABS.length - 1) / 2) * 212;
      const active = tab === this.chartTab;
      const bg = this.add
        .rectangle(x, y, 200, 48, active ? COLORS.parchmentLight : COLORS.parchmentDark)
        .setStrokeStyle(active ? 3 : 2, active ? COLORS.saddle : COLORS.saddleDark);
      this.add
        .text(x, y, label, {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: active ? HEX.ink : HEX.saddle
        })
        .setOrigin(0.5);
      if (!active) {
        bg.setInteractive({ useHandCursor: true }).on('pointerup', () =>
          this.scene.restart({ uid: this.critter.uid, chart: tab, from: this.from })
        );
      }
    });
  }

  /** Panel header shared by both views: title top-left, BARS/HEX toggle top-right. */
  private buildPanelHeader(y: number): void {
    this.add.text(64, y + 20, CHART_TITLE[this.chartTab], {
      fontFamily: FONT.ui,
      fontSize: '18px',
      color: HEX.saddle
    });
    (['bars', 'hex'] as ChartView[]).forEach((view, i) => {
      const x = 534 + i * 78;
      const active = view === this.chartView;
      const bg = this.add
        .rectangle(x, y + 30, 74, 34, active ? COLORS.parchmentLight : COLORS.parchmentDark)
        .setStrokeStyle(active ? 3 : 2, active ? COLORS.saddle : COLORS.saddleDark);
      this.add
        .text(x, y + 30, view.toUpperCase(), {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: active ? HEX.ink : HEX.saddle
        })
        .setOrigin(0.5);
      if (!active) {
        bg.setInteractive({ useHandCursor: true }).on('pointerup', () =>
          this.scene.restart({ uid: this.critter.uid, chart: this.chartTab, view, from: this.from })
        );
      }
    });
  }

  /**
   * Horizontal stat bars. STATS = sage base + denim pedigree stack;
   * BASE STATS = sage only; PEDIGREE = denim fill in a full-length socket
   * so the 15-point ceiling is visible, values shown as n/15.
   */
  private buildBars(y: number): void {
    const { width } = this.scale;
    const mode = this.chartTab;
    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 330, COLORS.parchmentLight, COLORS.saddle);
    this.buildPanelHeader(y);

    const barX = 130;
    const maxW = 440;
    STAT_LABELS.forEach(([key, label], i) => {
      const ry = y + 72 + i * 38;
      const { base, ped } = this.statTotal(key);
      this.add
        .text(64, ry, label, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
        .setOrigin(0, 0.5);
      if (mode === 'pedigree') {
        g.fillStyle(COLORS.ink);
        g.fillRect(barX - 2, ry - 15, maxW + 4, 30);
        g.fillStyle(COLORS.parchmentDark);
        g.fillRect(barX, ry - 13, maxW, 26);
        const w = Math.round((ped / 15) * maxW);
        if (w > 0) {
          g.fillStyle(COLORS.denim);
          g.fillRect(barX, ry - 13, w, 26);
        }
        this.add
          .text(barX + maxW + 12, ry, `${ped}/15`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink })
          .setOrigin(0, 0.5);
      } else {
        const shownPed = mode === 'stats' ? ped : 0;
        const baseW = Math.max(4, Math.round((base / STAT_SCALE_MAX) * maxW));
        const pedW = Math.round((shownPed / STAT_SCALE_MAX) * maxW);
        g.fillStyle(COLORS.ink);
        g.fillRect(barX - 2, ry - 15, baseW + pedW + 4, 30);
        g.fillStyle(COLORS.sage);
        g.fillRect(barX, ry - 13, baseW, 26);
        if (pedW > 0) {
          g.fillStyle(COLORS.denim);
          g.fillRect(barX + baseW, ry - 13, pedW, 26);
        }
        this.add
          .text(barX + baseW + pedW + 12, ry, `${base + shownPed}`, {
            fontFamily: FONT.ui,
            fontSize: '18px',
            color: HEX.ink
          })
          .setOrigin(0, 0.5);
      }
    });

    // legend, bottom right of the panel
    const ly = y + 294;
    if (mode === 'stats') {
      g.fillStyle(COLORS.sage);
      g.fillRect(388, ly + 2, 14, 14);
      this.add.text(410, ly, 'BASE', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle });
      g.fillStyle(COLORS.denim);
      g.fillRect(496, ly + 2, 14, 14);
      this.add.text(518, ly, 'PEDIGREE', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle });
    } else if (mode === 'base') {
      g.fillStyle(COLORS.sage);
      g.fillRect(552, ly + 2, 14, 14);
      this.add.text(574, ly, 'BASE', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle });
    }
  }

  /** Radar chart of the active tab's values (denim for pedigree, sage otherwise). */
  private buildHexChart(y: number): void {
    const { width } = this.scale;
    const mode = this.chartTab;
    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 330, COLORS.parchmentLight, COLORS.saddle);
    this.buildPanelHeader(y);
    const scaleMax = mode === 'pedigree' ? 15 : STAT_SCALE_MAX;
    const statValue = (key: keyof CritterInstance['pedigree']): number => {
      const { base, ped } = this.statTotal(key);
      return mode === 'pedigree' ? ped : mode === 'base' ? base : base + ped;
    };
    const cx = width / 2;
    // center + radius chosen so the vertex labels AND the value text under
    // them stay inside the 330px panel (the old 172/118 clipped the bottom)
    const cy = y + 168;
    const R = 100;
    const vertex = (i: number, r: number) => {
      const ang = -Math.PI / 2 + (i * Math.PI) / 3;
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
    };

    // rings + spokes
    for (const frac of [1 / 3, 2 / 3, 1]) {
      g.lineStyle(2, COLORS.ink, frac === 1 ? 0.4 : 0.18);
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const v = vertex(i % 6, R * frac);
        if (i === 0) g.moveTo(v.x, v.y);
        else g.lineTo(v.x, v.y);
      }
      g.strokePath();
    }
    g.lineStyle(2, COLORS.ink, 0.18);
    for (let i = 0; i < 6; i++) {
      const v = vertex(i, R);
      g.lineBetween(cx, cy, v.x, v.y);
    }

    // data polygon
    g.fillStyle(mode === 'pedigree' ? COLORS.denim : COLORS.sage, 0.55);
    g.lineStyle(3, COLORS.ink, 0.9);
    g.beginPath();
    HEX_STAT_LABELS.forEach(([key], i) => {
      const v = vertex(i, (Math.min(statValue(key), scaleMax) / scaleMax) * R);
      if (i === 0) g.moveTo(v.x, v.y);
      else g.lineTo(v.x, v.y);
    });
    g.closePath();
    g.fillPath();
    g.strokePath();

    // labels + values at the vertices
    HEX_STAT_LABELS.forEach(([key, label], i) => {
      const v = vertex(i, R + 32);
      this.add
        .text(v.x, v.y - 10, label, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.saddle })
        .setOrigin(0.5);
      this.add
        .text(v.x, v.y + 12, `${statValue(key)}`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink })
        .setOrigin(0.5);
    });
  }

  // ---------- release ----------

  private tryRelease(): void {
    if (gameState.data.herd.length <= 1) {
      this.showTempMsg("CAN'T TURN LOOSE YOUR LAST CRITTER");
      return;
    }
    if (this.critter.favorite) {
      this.showTempMsg('FAVORITES STAY - UNFAVORITE FIRST');
      return;
    }
    confirmDialog(
      this,
      'TURN LOOSE?',
      `${this.species.name} will wander back to the wild. This can't be undone.`,
      'RELEASE',
      () => {
        releaseCritters([this.critter.uid]);
        this.exitScene();
      },
      true
    );
  }

  private showTempMsg(msg: string): void {
    const { width, height } = this.scale;
    this.tempMsg?.destroy();
    this.tempMsg = this.add
      .text(width / 2, height - NAV_HEIGHT - 110, msg, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.saddle
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: this.tempMsg, alpha: 0, delay: 1100, duration: 300 });
  }
}
