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
    autoCenter: Phaser.Scale.CENTER_BOTH
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
    DailyScene
  ]
});

// iOS standalone (home-screen) launches can settle their safe-area insets
// a beat after our first measurement, without firing a resize event. Snap
// the canvas to the container again shortly after boot and on any viewport
// change; a mismatched aspect just letterboxes into the parchment bg.
const refresh = () => game.scale.refresh();
window.addEventListener('resize', refresh);
window.addEventListener('orientationchange', refresh);
window.visualViewport?.addEventListener('resize', refresh);
setTimeout(refresh, 350);
