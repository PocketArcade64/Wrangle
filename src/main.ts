import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { HomeScene } from './scenes/HomeScene';
import { CaptureSelectScene } from './scenes/CaptureSelectScene';
import { CaptureScene } from './scenes/CaptureScene';
import { AuctionScene } from './scenes/AuctionScene';
import { BountiesScene } from './scenes/BountiesScene';
import { PlayerScene } from './scenes/PlayerScene';
import { LassoScene } from './scenes/LassoScene';
import { LedgerScene } from './scenes/LedgerScene';
import { CritterScene } from './scenes/CritterScene';
import { TypeChartScene } from './scenes/TypeChartScene';
import { DailyScene } from './scenes/DailyScene';
import { MapScene } from './scenes/MapScene';
import { StageScene } from './scenes/StageScene';
import { DevScene } from './scenes/DevScene';
import { unlockAudio } from './audio/audio';

// Logical width is fixed; logical height adapts to the device's aspect ratio
// so tall phones (iPhone ~19.5:9) fill the screen instead of letterboxing.
// Measure the #game container (already inset to the iOS safe area by the
// CSS) rather than the raw window, so standalone/home-screen launches size
// to the visible region between the Dynamic Island and the home indicator.
const BASE_WIDTH = 720;
const gameEl = document.getElementById('game');
const vw = gameEl && gameEl.clientWidth > 0 ? gameEl.clientWidth : window.innerWidth;
const vh = gameEl && gameEl.clientHeight > 0 ? gameEl.clientHeight : window.innerHeight;
const aspect = vw > 0 ? vh / vw : 16 / 9;
const BASE_HEIGHT = Math.round(Phaser.Math.Clamp(BASE_WIDTH * aspect, 1280, 1600));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  backgroundColor: '#e8d9b5',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    // #game centers the canvas with flexbox. CENTER_BOTH would ALSO center
    // by adding margins to the canvas - flex then centers the margin box,
    // shifting the canvas down/right by half the margin whenever the boot
    // measurement disagrees with the settled container (the intermittent
    // standalone launch shift). Exactly one centerer: the CSS.
    autoCenter: Phaser.Scale.NO_CENTER
  },
  scene: [
    BootScene,
    TitleScene,
    HomeScene,
    CaptureSelectScene,
    CaptureScene,
    AuctionScene,
    BountiesScene,
    PlayerScene,
    LassoScene,
    LedgerScene,
    CritterScene,
    TypeChartScene,
    DailyScene,
    MapScene,
    StageScene,
    DevScene
  ]
});

// browsers gate audio behind a user gesture - unlock on the first tap
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

// iOS standalone (home-screen) launches settle their safe-area insets at an
// unpredictable moment in the first couple of seconds, without firing any
// resize event. A single delayed refresh can land mid-settle and leave the
// canvas mis-centered (shifted down/right) until relaunch - so re-snap on
// every viewport event AND on a spread of timers; the last one after the
// insets settle wins. A mismatched aspect just letterboxes into parchment.
const refresh = () => game.scale.refresh();
window.addEventListener('resize', refresh);
window.addEventListener('orientationchange', refresh);
window.visualViewport?.addEventListener('resize', refresh);
for (const ms of [100, 350, 700, 1200, 2000, 3000]) setTimeout(refresh, ms);
