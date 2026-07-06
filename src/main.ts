import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CaptureSelectScene } from './scenes/CaptureSelectScene';
import { CaptureScene } from './scenes/CaptureScene';

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
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, TitleScene, CaptureSelectScene, CaptureScene]
});
