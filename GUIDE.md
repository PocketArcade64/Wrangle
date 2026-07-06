# Wrangle

A western lasso-'em-up: Pokémon Ranger-style loop capturing meets a
16-bit cowboy world. Phaser 3 + TypeScript + Vite.

- Design: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Run locally (Mac)

```
npm install
npm run dev
```

Open the printed `localhost` URL. Keep `npm run dev` running — after each
`git pull`, Vite hot-reloads automatically.

## Current build — M2a menu shell + capture

Title → **HOME**: status bar (currency, stamina, avatar), the living diorama
(lead creature idling in the last-explored biome), the clay **EXPLORE**
button, satchel (daily bonus stub), and the 5-tab nav — Auction / Critters /
Home / Bounties / Player. Auction, Bounties, and Player are themed
placeholders; Critters (and Explore, until the map exists) opens the
scrollable dex, where tapping a creature starts a capture attempt.

The dex is driven entirely by
[src/data/creatures.csv](src/data/creatures.csv) in row order — 45 original
creatures with real pixel-art sprites from `public/sprites/`. Creatures
whose capture-behavior columns are still blank get gentle defaults (grazing,
3 loops, no attacks) until their stats are filled in.

Design tokens (palette, fonts, pixel-panel helpers) live in
[src/ui/theme.ts](src/ui/theme.ts); custom pixel icons in
[src/ui/icons.ts](src/ui/icons.ts); the design-system rules are documented
in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

### How to play

- **Draw loops** around the creature (mouse drag or touch). Closing a loop
  with the creature inside adds **+10** to the capture gauge shown below the
  creature. Fill the gauge to wrangle it.
- **Ranger-style line**: closing a loop only consumes the loop itself — the
  line you drew *before* the circle stays on the field, and you keep drawing
  from the point where the loop closed.
- **Keep looping!** If 4 seconds pass without closing a loop around the
  creature, the capture gauge starts draining quickly.
- **Don't touch the creature with the line** — it snaps the rope and empties
  the capture gauge (no damage).
- **Watch for the red `!`** — an attack is coming. If the burst hits your
  line, you lose HEALTH (the segmented bar at the bottom) *and* the gauge.
  All HEALTH segments empty = busted.
- **The rope isn't endless** — there's a hidden max length (no meter shown).
  Draw long sloppy tails and it snaps with "TOO MUCH ROPE!". Closing loops
  refunds their length, so tight efficient circles are the skill.
- Releasing the line just drops it — no penalty. After a break you must lift
  and press again to start a new line.

### Tuning

Capture feel knobs are at the top of
[src/scenes/CaptureScene.ts](src/scenes/CaptureScene.ts) (line width, health
bars, gauge decay delay/rate). Per-creature stats live in the spreadsheet
[src/data/creatures.csv](src/data/creatures.csv) — editable in Excel; column
reference in [docs/CREATURES.md](docs/CREATURES.md).
