# Wrangle — Game Design Document

A 2D mobile game blending Pokémon Ranger-style lasso-loop capturing with a
western theme: a cowboy is transported from catching farm animals into an
alternate dimension full of monsters.

## Pillars

- **Polished 16-bit retro aesthetic.** All art and music fully original,
  never sourced online. Calming original music with clear western influence;
  the track changes per area. Silkscreen font for all game text.
- **Skill-based capture.** The lasso mini-game is the heart of the game.
- **Collect, grow, trade.** Party building, XP, IVs, items, and a shared
  auction house.

## Story framing

Tutorial: a cowboy catching farm animals on the ranch. Then he's transported
to an alternate dimension full of monsters — same lasso, wilder targets.

## Capture mini-game (lasso)

Direct adaptation of the Pokémon Ranger loop mechanic:

- Player drags to draw a continuous **capture line** with a max total
  length on the field (starting budget ~1500px, sized after Almia's starting
  styler: ~2.5 comfortable loops). The budget is **hidden — no meter is
  shown**; running out snaps the line ("TOO MUCH ROPE!"). Closing a loop
  refunds that loop's length. Line length is a lasso-upgrade axis later.
- When the line crosses itself with the target enclosed, that's **one loop**,
  worth **+10 on the capture gauge** displayed under the creature; the gauge
  full = captured. Per Shadows of Almia: closing a loop consumes ONLY the
  loop portion — the tail drawn before the loop stays live on the field
  (still loopable, still breakable) and drawing continues from the crossing
  point. Each creature has a required loop count (weak: 2–3,
  legendary-tier: much higher).
- **Gauge decay**: if ~4 seconds pass without closing a loop around the
  target, the gauge drains quickly — sustained pressure is the skill, and
  releasing the line carries no penalty (this replaces the older
  stun-on-release anti-cheese).
- **Body touch** on the line: line breaks, capture gauge empties, no HP
  loss. Annoying, not dangerous.
- **Attacks**: creature telegraphs (cry + `!` above its head, ~0.8s), then
  fires a hazard (projectile / radial burst / melee lunge). If the hazard hits
  the live line: line breaks, gauge empties, **and lasso HEALTH takes
  damage** (segmented bar). HEALTH 0 = capture failed. This body-vs-attack
  distinction is what makes it skill-based.
- Each species has a distinct **movement pattern** (graze, flee, charge,
  teleport/counter, sleeping) and **attack pattern**; difficulty is tuned by
  pattern speed/size, not just loop count.

### Lasso upgrades (implemented v1 — src/data/lassoUpgrades.ts)

Dust spent in THE LASSO menu (Player tab → UPGRADE LASSO). Each stat is
repeatable to a max with escalating costs (level n→n+1 costs base×(n+1)):

- **ROPE LENGTH** (max 5, base 50): +150px hidden rope budget per level.
- **GRIT** (max 3, base 75): +1 health bar per level (5 base).
- **CHARGE** (max 5, base 50): gauge holds its charge longer — +0.6s decay
  grace and −8% drain rate per level.

Future candidates from the original design: capture power (gauge per loop),
damage reduction, Dust earned per capture, power when low.

## Battle levels (Pokémon Rumble style)

- Your creature auto-advances toward enemies; 1–2 buttons at the bottom
  trigger its attacks (1 button if single-type). Optional auto-battle button.
- Each creature is a **physical or special attacker**; each capture rolls
  **random IVs**.
- Party of **3 creatures** per level; they gain XP per enemy defeated.
  Saved-teams button for favorites.
- After defeating an enemy: **1-in-5 chance** to trigger the lasso capture
  mini-game on it.
- Every defeated monster drops currency; captured monsters drop more.

## Exploration / map

- Map screen: **drop a pin** to choose where to explore.
- **Stamina** (hourly refresh) gates new pins; your **last 3 locations** are
  revisitable endlessly. Favoriting a location protects it from being
  overwritten by new explorations.
- Each location's monster table is fixed; placement within a run is random.
  Levels are procedurally generated.

## Meta systems

- **Collection screen**: all owned creatures, Pokémon GO-style grid.
- **Items**: 1 equippable item per creature (bought in shop) + limited-time
  consumables (~30 min boosts).
- **Daily**: login bonus + daily wheel spin; watching an ad allows endless
  spins of a worse-rewards wheel.
- **Auction/marketplace**: shared player-to-player creature auctions
  (inspired by Virtual Pet Collector). Requires a real backend.

## UI design system (canonical - src/ui/theme.ts)

Sun-worn, screen-printed-poster look. Grounded in the frontier subject, not
generic monster-collector UI.

| Token | Hex | Role |
|---|---|---|
| parchment | #E8D9B5 | Base background - aged paper, never stark white |
| saddle | #7A4A2B | Structural - frames, nav bar, borders |
| clay | #C1652F | THE one accent - Explore CTA + active nav tab only |
| sage | #7C8B6F | Calm secondary - stamina, passive UI |
| dusk-denim | #3F5C6C | Cool counterpoint - water biome, special tint |
| ink | #2B221A | Text |
| brass | #B8912A | Currency ONLY - reserved so it stays meaningful |

Hard rules:
- **No rounded corners anywhere. No gradients. No glow.** Flat fills, square
  pixels, hard-offset ink shadows for depth.
- Exactly one saturated color (clay) so the eye knows what's actionable.
- No red urgency numerals on stamina/timers (sage - running low isn't
  failure). No gem-sparkle on brass counters.
- No forced popups on launch: daily bonus is a badge dot on the satchel.

Typography (two bitmap faces, never Press Start 2P):
- Display: chunky branding-iron face for headers/logo. Pixelify Sans is the
  stand-in until the custom bitmap face is drawn (M7 art pass).
- UI/body: Silkscreen - tight pixel grid, legible small.

Navigation: 5 tabs - Auction (gavel) / Critters (lasso) / Home (house) /
**Bounties** (sheriff star) / Player (hat). Flat single-color glyphs in
saddle; active tab clay. All glyphs are custom pixel bitmaps
(src/ui/icons.ts).

Critters screen: two tabs - **MY HERD** (wrangled critters, from the save)
and **TALLY BOOK** (the full species register; a cattleman's tally book is
the in-world "dex"). Wrangling a critter adds it to the herd and pays out
Dust.

Bounty board: 3 wanted posters daily, seeded from the date (stable across
tab switches/restarts/devices, roll over at local midnight, live countdown
shown). One per day is the **MOST WANTED** - red print (wantedRed token:
in-world poster ink, the one sanctioned red - never UI urgency) and double
reward.

Home screen: quiet status bar (brass currency, sage stamina pips, avatar) /
**living diorama** - the signature element: a wood-framed postcard of the
last-explored biome with the lead creature idle-animating and drifting dust
motes; previews what Explore drops you into / single clay EXPLORE CTA /
tucked satchel icon with badge / nav.

## Tech

- **Engine**: Phaser 3 (TypeScript + Vite). Runs in browser during dev;
  wrapped with Capacitor + Xcode for iOS at the end.
- **Persistence**: local-first (IndexedDB / Capacitor SQLite) layered with a
  cloud backend (Supabase or Firebase) — required for auctions and
  cross-device user progress.
- **Font**: Silkscreen everywhere (self-host before shipping).
- **Art**: creator-supplied original pixel-art sprites (in progress; repo
  currently uses generated placeholders).
