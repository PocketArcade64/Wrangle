import Phaser from 'phaser';
import { COLORS, FONT, HEX } from './theme';
import { ensureIcons } from './icons';

export type NavTab = 'auction' | 'collection' | 'home' | 'bounties' | 'player';

export const NAV_HEIGHT = 110;

const TABS: { tab: NavTab; icon: string; label: string; scene: string }[] = [
  { tab: 'auction', icon: 'icon-gavel', label: 'AUCTION', scene: 'Auction' },
  { tab: 'collection', icon: 'icon-lasso', label: 'CRITTERS', scene: 'CaptureSelect' },
  { tab: 'home', icon: 'icon-home', label: 'HOME', scene: 'Home' },
  { tab: 'bounties', icon: 'icon-star', label: 'BOUNTIES', scene: 'Bounties' },
  { tab: 'player', icon: 'icon-hat', label: 'PLAYER', scene: 'Player' }
];

/**
 * Persistent bottom nav. Flat single-color glyphs in saddle; the active tab
 * (and only the active tab) gets clay plus a clay tick above it.
 */
export function buildNav(scene: Phaser.Scene, active: NavTab): void {
  ensureIcons(scene);
  const { width, height } = scene.scale;
  const top = height - NAV_HEIGHT;

  const g = scene.add.graphics().setDepth(50);
  g.fillStyle(COLORS.parchmentDark);
  g.fillRect(0, top, width, NAV_HEIGHT);
  g.fillStyle(COLORS.saddle);
  g.fillRect(0, top, width, 4);

  const slot = width / TABS.length;
  TABS.forEach((t, i) => {
    const cx = slot * i + slot / 2;
    const isActive = t.tab === active;
    const color = isActive ? COLORS.clay : COLORS.saddle;
    scene.add.image(cx, top + 46, t.icon).setTint(color).setDepth(51);
    scene.add
      .text(cx, top + 84, t.label, {
        fontFamily: FONT.ui,
        fontSize: '12px',
        color: isActive ? HEX.clay : HEX.saddle
      })
      .setOrigin(0.5)
      .setDepth(51);
    if (isActive) {
      g.fillStyle(COLORS.clay);
      g.fillRect(cx - 22, top + 4, 44, 4);
    } else {
      scene.add
        .rectangle(cx, top + NAV_HEIGHT / 2, slot, NAV_HEIGHT, 0xffffff, 0)
        .setDepth(52)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => scene.scene.start(t.scene));
    }
  });
}
