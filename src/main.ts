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

// Logical width is fixed; logical height adapts to the device's aspect ratio
// so tall phones (iPhone ~19.5:9) fill the screen instead of letterboxing.
const BASE_WIDTH = 720;
const aspect = window.innerWidth > 0 ? window.innerHeight / window.innerWidth : 16 / 9;
const BASE_HEIGHT = Math.round(Phaser.Math.Clamp(BASE_WIDTH * aspect, 1280, 1600));

new Phaser.Game({
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
    CritterScene
  ]
});
