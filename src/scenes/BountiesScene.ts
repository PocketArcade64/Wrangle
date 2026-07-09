import Phaser from 'phaser';
import { SpeciesDef } from '../data/species';
import { EVOLUTIONS, EVOLVED_IDS } from '../data/evolutions';
import { STAGE_THEMES, themeSpeciesPool } from '../data/stages';
import { gameState } from '../state/GameState';
import { releaseCritters } from '../state/herdOps';
import { confirmDialog } from '../ui/confirm';
import { sfx } from '../audio/audio';
import { COLORS, FONT, HEX, drawPixelPanel } from '../ui/theme';
import { ensureIcons } from '../ui/icons';
import { makeButton } from '../ui/button';
import { buildNav, NAV_HEIGHT } from '../ui/nav';
import { dateKey, msUntilMidnight, seededRng } from '../util/daily';

const BASE_REWARDS = [120, 160, 200];
const BOARD_X = 36;
const BOARD_Y = 110;
const BOARD_H = 1410;

/** Daily challenges - tallies bumped by gameplay via gameState.bumpQuest. */
const CHALLENGES: { id: string; stat: string; label: string; need: number; reward: number }[] = [
  { id: 'catch5', stat: 'catches', label: 'WRANGLE ANY 5 CRITTERS', need: 5, reward: 60 },
  { id: 'stage10', stat: 'stages', label: 'CLEAR 10 STAGES', need: 10, reward: 150 },
  { id: 'flats2', stat: 'flats', label: 'CLEAR 2 FRONTIER FLATS STAGES', need: 2, reward: 50 },
  { id: 'posse3', stat: 'fullPosse', label: 'FINISH A STAGE WITH ALL 3 STANDING', need: 1, reward: 80 },
  { id: 'grass1', stat: 'grassClear', label: 'CLEAR A STAGE WITH ONLY GRASS TYPES', need: 1, reward: 80 }
];

/**
 * The bounty board, now a working office: the classic 3 wanted posters up
 * top (names hidden until seen), ROUNDUP CONTRACTS that take multiple
 * critters (basics/stage-1 only, progress bar fills per turn-in, reward on
 * completion - only critters CAUGHT TODAY are accepted), and a column of
 * daily challenges fed by gameplay tallies. Everything rolls at sunup.
 * The board scrolls (drag + momentum).
 */
export class BountiesScene extends Phaser.Scene {
  private countdown!: Phaser.GameObjects.Text;
  private content!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private minScroll = 0;
  private dragging = false;
  private dragStartY = 0;
  private scrollStart = 0;
  private scrollVel = 0;
  private lastMoveY = 0;
  private lastMoveT = 0;
  private tempMsg?: Phaser.GameObjects.Text;

  constructor() {
    super('Bounties');
  }

  create(): void {
    ensureIcons(this);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(HEX.parchment);
    this.scrollY = 0;
    this.dragging = false;
    this.scrollVel = 0;
    this.tempMsg = undefined;

    this.content = this.add.container(0, 0);

    const title = this.add
      .text(width / 2, 64, 'BOUNTY BOARD', { fontFamily: FONT.display, fontSize: '44px', color: HEX.ink })
      .setOrigin(0.5);
    this.content.add(title);

    // the wooden board
    const boardW = width - 72;
    const g = this.add.graphics();
    this.content.add(g);
    g.fillStyle(COLORS.ink);
    g.fillRect(BOARD_X - 3, BOARD_Y - 3, boardW + 6, BOARD_H + 6);
    g.fillStyle(COLORS.saddle);
    g.fillRect(BOARD_X, BOARD_Y, boardW, BOARD_H);
    g.fillStyle(COLORS.saddleDark);
    for (let py = BOARD_Y + 46; py < BOARD_Y + BOARD_H; py += 92) {
      g.fillRect(BOARD_X, py, boardW, 3);
    }

    // species you can actually find in the unlocked maps
    const findable: SpeciesDef[] = [];
    for (const id of Object.keys(STAGE_THEMES)) {
      for (const sp of themeSpeciesPool(id)) {
        if (!findable.includes(sp)) findable.push(sp);
      }
    }
    const rng = seededRng(`bounty-${dateKey()}`);
    const order = [...findable];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    // row 1: the classic three (unchanged behavior, names gated by seen)
    const picks = order.slice(0, 3);
    const mostWantedIdx = Math.floor(rng() * Math.max(1, picks.length));
    const posterW = 176;
    const gap = (boardW - posterW * 3) / 4;
    picks.forEach((sp, i) => {
      const most = i === mostWantedIdx;
      const px = BOARD_X + gap + i * (posterW + gap);
      const py = BOARD_Y + 44 + (i % 2) * 30;
      this.drawPoster(px, py, posterW, 250, sp, most, BASE_REWARDS[i] * (most ? 2 : 1));
    });

    // row 2: roundup contracts (multi-critter turn-ins, basics/stage-1)
    const stage1 = new Set(
      Object.entries(EVOLUTIONS)
        .filter(([base]) => !EVOLVED_IDS.has(base))
        .map(([, evo]) => evo)
    );
    const contractPool = order.filter(
      (sp) => !picks.includes(sp) && (!EVOLVED_IDS.has(sp.id) || stage1.has(sp.id))
    );
    const contracts = contractPool.slice(0, 2);
    const cy = BOARD_Y + 372;
    this.content.add(
      this.add
        .text(width / 2, cy, 'ROUNDUP CONTRACTS', { fontFamily: FONT.display, fontSize: '24px', color: HEX.parchment })
        .setOrigin(0.5)
    );
    contracts.forEach((sp, i) => {
      const need = 2 + Math.floor(rng() * 2);
      const reward = need * 70;
      const px = BOARD_X + 23 + i * (290 + 23);
      this.drawContract(px, cy + 26, 290, 344, sp, need, reward);
    });

    // row 3: daily challenges
    const chY = BOARD_Y + 776;
    this.content.add(
      this.add
        .text(width / 2, chY, 'DAILY CHALLENGES', { fontFamily: FONT.display, fontSize: '24px', color: HEX.parchment })
        .setOrigin(0.5)
    );
    CHALLENGES.forEach((ch, i) => this.drawChallenge(ch, chY + 30 + i * 92));

    // the sheriff's note, bottom left of the board
    this.drawSheriffNote(BOARD_X + 16, BOARD_Y + BOARD_H - 128);

    const sub = this.add
      .text(width / 2, BOARD_Y + BOARD_H + 28, 'DAILY BOUNTIES POST AT SUNUP', {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.sage
      })
      .setOrigin(0.5);
    this.content.add(sub);
    this.countdown = this.add
      .text(width / 2, BOARD_Y + BOARD_H + 60, '', { fontFamily: FONT.ui, fontSize: '19px', color: HEX.saddle })
      .setOrigin(0.5);
    this.content.add(this.countdown);
    this.updateCountdown();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updateCountdown() });

    this.minScroll = Math.min(0, height - NAV_HEIGHT - (BOARD_Y + BOARD_H + 96));
    this.bindScroll();
    buildNav(this, 'bounties');
  }

  // ---------- scrolling (drag + momentum) ----------

  private bindScroll(): void {
    const { height } = this.scale;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > height - NAV_HEIGHT) return;
      this.dragging = true;
      this.dragStartY = p.y;
      this.scrollStart = this.scrollY;
      this.scrollVel = 0;
      this.lastMoveY = p.y;
      this.lastMoveT = this.time.now;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
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

  private updateCountdown(): void {
    const total = Math.floor(msUntilMidnight() / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    this.countdown.setText(`NEW BOUNTIES IN ${pad(h)}:${pad(m)}:${pad(s)}`);
  }

  private seen(sp: SpeciesDef): boolean {
    return (gameState.data.seen[sp.id] ?? 0) > 0 || gameState.data.herd.some((c) => c.speciesId === sp.id);
  }

  // ---------- the classic three ----------

  private drawPoster(x: number, y: number, w: number, h: number, sp: SpeciesDef, mostWanted: boolean, reward: number): void {
    const g = this.add.graphics();
    this.content.add(g);
    g.fillStyle(COLORS.ink);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(COLORS.parchment);
    g.fillRect(x, y, w, h);
    g.fillStyle(COLORS.ink);
    g.fillRect(x + w / 2 - 3, y + 6, 6, 6);

    this.content.add(
      this.add
        .text(x + w / 2, mostWanted ? y + 40 : y + 34, mostWanted ? 'MOST\nWANTED' : 'WANTED', {
          fontFamily: FONT.display,
          fontSize: '26px',
          color: mostWanted ? HEX.wantedRed : HEX.ink,
          align: 'center'
        })
        .setOrigin(0.5)
    );

    const key = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const img = this.add.image(x + w / 2, y + 122, key).setTintFill(COLORS.ink).setAlpha(0.85);
    this.content.add(img);

    this.content.add(
      this.add
        .text(x + w / 2, y + 184, this.seen(sp) ? sp.name.toUpperCase() : '???', {
          fontFamily: FONT.ui,
          fontSize: '19px',
          color: HEX.ink
        })
        .setOrigin(0.5)
    );
    this.rewardRow(x + w / 2, y + 222, reward);
  }

  private rewardRow(cx: number, cy: number, reward: number): void {
    const rewardTxt = this.add
      .text(0, 0, `${reward}`, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.brass })
      .setOrigin(0, 0.5);
    const coin = this.add.image(0, 0, 'icon-coin').setTint(COLORS.brass).setScale(0.6);
    const coinW = 44 * 0.6;
    const rowW = coinW + 8 + rewardTxt.width;
    coin.x = -rowW / 2 + coinW / 2;
    rewardTxt.x = -rowW / 2 + coinW + 8;
    this.content.add(this.add.container(cx, cy, [coin, rewardTxt]));
  }

  // ---------- roundup contracts ----------

  private drawContract(x: number, y: number, w: number, h: number, sp: SpeciesDef, need: number, reward: number): void {
    const q = gameState.quests();
    const have = Math.min(need, q.turnIns[sp.id] ?? 0);
    const done = have >= need;
    const revealed = this.seen(sp);

    const g = this.add.graphics();
    this.content.add(g);
    g.fillStyle(COLORS.ink);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(COLORS.parchment);
    g.fillRect(x, y, w, h);
    g.fillStyle(COLORS.ink);
    g.fillRect(x + w / 2 - 3, y + 6, 6, 6);

    this.content.add(
      this.add
        .text(x + w / 2, y + 34, 'ROUNDUP', { fontFamily: FONT.display, fontSize: '26px', color: HEX.ink })
        .setOrigin(0.5)
    );
    const key = this.textures.exists(sp.textureKey) ? sp.textureKey : 'pl-unknown';
    const img = this.add.image(x + w / 2, y + 118, key).setDisplaySize(104, 104);
    if (!revealed) img.setTintFill(COLORS.ink).setAlpha(0.85);
    this.content.add(img);
    this.content.add(
      this.add
        .text(x + w / 2, y + 186, revealed ? sp.name.toUpperCase() : '???', {
          fontFamily: FONT.ui,
          fontSize: '19px',
          color: HEX.ink
        })
        .setOrigin(0.5)
    );
    this.content.add(
      this.add
        .text(x + w / 2, y + 214, `DELIVER ${need}`, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.saddle })
        .setOrigin(0.5)
    );

    // progress bar: one segment per critter turned in
    const barW = w - 60;
    const segW = Math.floor((barW - (need - 1) * 6) / need);
    g.fillStyle(COLORS.ink);
    g.fillRect(x + 28, y + 234, barW + 4, 22);
    for (let i = 0; i < need; i++) {
      g.fillStyle(i < have ? COLORS.sage : COLORS.parchmentDark);
      g.fillRect(x + 30 + i * (segW + 6), y + 236, segW, 18);
    }

    this.rewardRow(x + w / 2, y + 282, reward);
    if (done) {
      this.content.add(
        this.add
          .text(x + w / 2, y + 316, 'CONTRACT FILLED', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.wantedRed })
          .setOrigin(0.5)
      );
    } else {
      this.content.add(
        this.add
          .text(x + w / 2, y + 316, 'TAP TO TURN IN', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.sage })
          .setOrigin(0.5)
      );
      const hit = this.add
        .rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.tryTurnIn(sp, need, reward));
      this.content.add(hit);
    }
  }

  private tryTurnIn(sp: SpeciesDef, need: number, reward: number): void {
    const q = gameState.quests();
    if ((q.turnIns[sp.id] ?? 0) >= need) return;
    if (gameState.data.herd.length <= 1) {
      this.showMsg("CAN'T TURN IN YOUR LAST CRITTER");
      return;
    }
    const today = dateKey();
    const candidate = gameState.data.herd.find(
      (c) => c.speciesId === sp.id && !c.favorite && dateKey(new Date(c.caughtAt)) === today
    );
    if (!candidate) {
      this.showMsg('ONLY TAKIN\' CRITTERS ROPED TODAY, PARDNER');
      return;
    }
    confirmDialog(
      this,
      'TURN IN?',
      `One ${sp.name} (caught today) rides off to the bounty office. This can't be undone.`,
      'TURN IN',
      () => {
        sfx('release');
        releaseCritters([candidate.uid]);
        const q2 = gameState.quests();
        q2.turnIns[sp.id] = (q2.turnIns[sp.id] ?? 0) + 1;
        if (q2.turnIns[sp.id] >= need) {
          gameState.data.currency += reward;
          sfx('clear');
        }
        gameState.save();
        this.scene.restart();
      },
      true
    );
  }

  // ---------- daily challenges ----------

  private drawChallenge(ch: { id: string; stat: string; label: string; need: number; reward: number }, y: number): void {
    const { width } = this.scale;
    const q = gameState.quests();
    const have = Math.min(ch.need, q.stats[ch.stat] ?? 0);
    const done = have >= ch.need;
    const claimed = q.claimed.includes(ch.id);

    const g = this.add.graphics();
    this.content.add(g);
    drawPixelPanel(g, BOARD_X + 20, y, width - 72 - 40, 80, COLORS.parchment, COLORS.saddleDark, 3);
    this.content.add(
      this.add.text(BOARD_X + 40, y + 12, ch.label, { fontFamily: FONT.ui, fontSize: '18px', color: HEX.ink })
    );
    // progress bar + tally
    const barW = 300;
    g.fillStyle(COLORS.ink);
    g.fillRect(BOARD_X + 40, y + 46, barW + 4, 18);
    g.fillStyle(COLORS.parchmentDark);
    g.fillRect(BOARD_X + 42, y + 48, barW, 14);
    g.fillStyle(COLORS.sage);
    g.fillRect(BOARD_X + 42, y + 48, Math.round(barW * (have / ch.need)), 14);
    this.content.add(
      this.add
        .text(BOARD_X + 40 + barW + 20, y + 55, `${have}/${ch.need}`, {
          fontFamily: FONT.ui,
          fontSize: '18px',
          color: HEX.saddle
        })
        .setOrigin(0, 0.5)
    );

    if (claimed) {
      this.content.add(
        this.add
          .text(width - 76, y + 40, 'PAID', { fontFamily: FONT.ui, fontSize: '18px', color: HEX.sage })
          .setOrigin(1, 0.5)
      );
    } else if (done) {
      this.content.add(
        makeButton(this, width - 130, y + 40, 130, 52, 'CLAIM', () => {
          const q2 = gameState.quests();
          if (q2.claimed.includes(ch.id)) return;
          q2.claimed.push(ch.id);
          gameState.data.currency += ch.reward;
          gameState.save();
          sfx('coin');
          this.scene.restart();
        }, '18px')
      );
    } else {
      this.rewardRow(width - 110, y + 40, ch.reward);
    }
  }

  /** The sheriff's standing notice, tacked to the board's bottom left. */
  private drawSheriffNote(x: number, y: number): void {
    const g = this.add.graphics();
    this.content.add(g);
    g.fillStyle(COLORS.ink);
    g.fillRect(x - 2, y - 2, 344, 108);
    g.fillStyle(COLORS.parchmentLight);
    g.fillRect(x, y, 340, 104);
    g.fillStyle(COLORS.ink);
    g.fillRect(x + 166, y + 4, 6, 6);
    this.content.add(
      this.add.text(x + 14, y + 14, "SHERIFF'S NOTICE:\nWE ONLY TAKE CRITTERS ROPED\nTHAT SAME DAY. FRESH\nCATCHES ONLY!", {
        fontFamily: FONT.ui,
        fontSize: '16px',
        color: HEX.ink
      })
    );
  }

  private showMsg(msg: string): void {
    const { width, height } = this.scale;
    this.tempMsg?.destroy();
    this.tempMsg = this.add
      .text(width / 2, height - NAV_HEIGHT - 60, msg, {
        fontFamily: FONT.ui,
        fontSize: '18px',
        color: HEX.parchment,
        backgroundColor: HEX.ink,
        padding: { x: 12, y: 8 }
      })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: this.tempMsg, alpha: 0, delay: 1600, duration: 300 });
  }
}
