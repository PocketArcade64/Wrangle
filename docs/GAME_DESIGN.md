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

- Player drags to draw a continuous **capture line** with a max length budget
  ("rope"/ink). Budget is per-loop: it resets each time a loop closes.
- When the line crosses itself with the target enclosed, that's **one loop**.
  The line restarts from the crossing point. Each creature has a required
  loop count (weak: 2–3, legendary-tier: much higher).
- **Body touch** on the line: line breaks, banked loop progress resets to
  zero, no HP loss. Annoying, not dangerous.
- **Attacks**: creature telegraphs (cry + `!` above its head, ~0.8s), then
  fires a hazard (projectile / radial burst / melee lunge). If the hazard hits
  the live line: line breaks, loops reset, **and lasso HP (GRIT) takes
  damage**. GRIT 0 = capture failed. This body-vs-attack distinction is what
  makes it skill-based.
- **Release mid-draw** with banked loops: target is briefly stunned, but loop
  progress is blocked during the stun, and after it ends the target gets
  faster ("riled") — anti-cheese so release/redraw isn't free safety.
- Each species has a distinct **movement pattern** (graze, flee, charge,
  teleport/counter, sleeping) and **attack pattern**; difficulty is tuned by
  pattern speed/size, not just loop count.

### Lasso upgrades (post-capture progression)

Points spent on a menu of stats, each repeatable with progressively higher
costs (diminishing returns → real build choices): max energy/GRIT, power,
max line length, damage reduction, reduced charge time, energy regained per
capture, power when low.

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

## Tech

- **Engine**: Phaser 3 (TypeScript + Vite). Runs in browser during dev;
  wrapped with Capacitor + Xcode for iOS at the end.
- **Persistence**: local-first (IndexedDB / Capacitor SQLite) layered with a
  cloud backend (Supabase or Firebase) — required for auctions and
  cross-device user progress.
- **Font**: Silkscreen everywhere (self-host before shipping).
- **Art**: creator-supplied original pixel-art sprites (in progress; repo
  currently uses generated placeholders).
