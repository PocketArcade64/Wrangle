import Phaser from 'phaser';
import { SPECIES, SpeciesDef } from '../data/species';
import { badgeName } from '../data/typeChart';
import { CritterInstance, gameState } from '../state/GameState';
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
// CSV base stats are blank until balancing - show a provisional 50
const PROVISIONAL_BASE = 50;
const STAT_SCALE_MAX = 165; // display ceiling: strong base 150 + pedigree 15

type ChartTab = 'current' | 'base' | 'hex' | 'pedhex';

const CHART_TABS: { tab: ChartTab; label: string }[] = [
  { tab: 'current', label: 'CURRENT' },
  { tab: 'base', label: 'BASE' },
  { tab: 'hex', label: 'HEX' },
  { tab: 'pedhex', label: 'PEDIGREE' }
];

/**
 * One specific critter from your herd (Pokemon GO-style page, frontier
 * flavored): portrait on a scenic band, types, attacker style, current
 * moves, and a four-tab stat view - CURRENT (base + pedigree, horizontal
 * bars), BASE (base only bars), HEX (current-stat radar) and PEDIGREE
 * (bloodline-bonus radar, 0-15 scale).
 */
export class CritterScene extends Phaser.Scene {
  private critter!: CritterInstance;
  private species!: SpeciesDef;
  private chartTab: ChartTab = 'current';
  private favStar!: Phaser.GameObjects.Image;
  private tempMsg?: Phaser.GameObjects.Text;

  constructor() {
    super('Critter');
  }

  init(data: { uid: string; chart?: ChartTab }): void {
    const found = gameState.data.herd.find((c) => c.uid === data.uid);
    if (!found) {
      this.scene.start('CaptureSelect', { tab: 'herd' });
      return;
    }
    this.critter = found;
    this.species = SPECIES.find((s) => s.id === found.speciesId) ?? SPECIES[0];
    this.chartTab = data.chart ?? 'current';
  }

  create(): void {
    if (!this.critter) return;
    ensureIcons(this);
    const { width, height } = this.scale;
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

    makeButton(this, 84, 52, 130, 54, 'BACK', () => this.scene.start('CaptureSelect', { tab: 'herd' }), '18px');

    // favorite: clay = active state. Favorites can't be released, turned in
    // for bounties, or auctioned.
    this.favStar = this.add.image(width - 56, 52, 'icon-star').setScale(1.1);
    this.paintFavStar();
    this.favStar.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.critter.favorite = !this.critter.favorite;
      gameState.save();
      this.paintFavStar();
    });

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

    this.buildMoves(500);
    this.buildChartTabs(690);
    const chartY = 728;
    if (this.chartTab === 'current') this.buildBars(chartY, true);
    else if (this.chartTab === 'base') this.buildBars(chartY, false);
    else this.buildHexChart(chartY, this.chartTab === 'pedhex');

    makeButton(this, width / 2, height - NAV_HEIGHT - 56, 300, 66, 'TURN LOOSE', () => this.tryRelease(), '18px');

    buildNav(this, 'collection');
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
      const x = width / 2 + (i - (CHART_TABS.length - 1) / 2) * 164;
      const active = tab === this.chartTab;
      const bg = this.add
        .rectangle(x, y, 158, 48, active ? COLORS.parchmentLight : COLORS.parchmentDark)
        .setStrokeStyle(active ? 3 : 2, active ? COLORS.saddle : COLORS.saddleDark);
      this.add
        .text(x, y, label, {
          fontFamily: FONT.ui,
          fontSize: '16px',
          color: active ? HEX.ink : HEX.saddle
        })
        .setOrigin(0.5);
      if (!active) {
        bg.setInteractive({ useHandCursor: true }).on('pointerup', () =>
          this.scene.restart({ uid: this.critter.uid, chart: tab })
        );
      }
    });
  }

  /** Horizontal stat bars: base in sage, plus the pedigree bonus in denim. */
  private buildBars(y: number, withPedigree: boolean): void {
    const { width } = this.scale;
    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 330, COLORS.parchmentLight, COLORS.saddle);
    // legend
    g.fillStyle(COLORS.sage);
    g.fillRect(64, y + 16, 14, 14);
    this.add.text(86, y + 15, 'BASE', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle });
    if (withPedigree) {
      g.fillStyle(COLORS.denim);
      g.fillRect(170, y + 16, 14, 14);
      this.add.text(192, y + 15, 'PEDIGREE', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle });
    }

    const barX = 130;
    const maxW = 460;
    STAT_LABELS.forEach(([key, label], i) => {
      const ry = y + 74 + i * 42;
      const { base, ped } = this.statTotal(key);
      const shownPed = withPedigree ? ped : 0;
      const baseW = Math.max(4, Math.round((base / STAT_SCALE_MAX) * maxW));
      const pedW = Math.round((shownPed / STAT_SCALE_MAX) * maxW);
      this.add
        .text(64, ry, label, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle })
        .setOrigin(0, 0.5);
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
          fontSize: '17px',
          color: HEX.ink
        })
        .setOrigin(0, 0.5);
    });
  }

  /** Radar chart: current stats (sage) or the pedigree alone on a 0-15 scale (denim). */
  private buildHexChart(y: number, pedigreeOnly: boolean): void {
    const { width } = this.scale;
    const g = this.add.graphics();
    drawPixelPanel(g, 40, y, width - 80, 330, COLORS.parchmentLight, COLORS.saddle);
    this.add.text(64, y + 14, pedigreeOnly ? 'PEDIGREE (MAX 15)' : 'CURRENT STATS', {
      fontFamily: FONT.ui,
      fontSize: '16px',
      color: HEX.saddle
    });
    const scaleMax = pedigreeOnly ? 15 : STAT_SCALE_MAX;
    const statValue = (key: keyof CritterInstance['pedigree']): number => {
      const { base, ped } = this.statTotal(key);
      return pedigreeOnly ? ped : base + ped;
    };
    const cx = width / 2;
    const cy = y + 172;
    const R = 118;
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
    g.fillStyle(pedigreeOnly ? COLORS.denim : COLORS.sage, 0.55);
    g.lineStyle(3, COLORS.ink, 0.9);
    g.beginPath();
    STAT_LABELS.forEach(([key], i) => {
      const v = vertex(i, (Math.min(statValue(key), scaleMax) / scaleMax) * R);
      if (i === 0) g.moveTo(v.x, v.y);
      else g.lineTo(v.x, v.y);
    });
    g.closePath();
    g.fillPath();
    g.strokePath();

    // labels + values at the vertices
    STAT_LABELS.forEach(([key, label], i) => {
      const v = vertex(i, R + 34);
      this.add
        .text(v.x, v.y - 9, label, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle })
        .setOrigin(0.5);
      this.add
        .text(v.x, v.y + 11, `${statValue(key)}`, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.ink })
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
        this.scene.start('CaptureSelect', { tab: 'herd' });
      }
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
