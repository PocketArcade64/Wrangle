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

## Current build — M1 capture prototype

Title → **PICK A TARGET** → capture arena. Three placeholder targets
(real pixel-art sprites come later):

| Target | Loops | Behavior |
|---|---|---|
| BESSIE (cow) | 2 | Slow grazer, harmless — the tutorial feel |
| PECKSY (hen) | 3 | Flees your finger/cursor, tests rope management |
| DUSTDEVIL | 4 | Charges at you and fires radial bursts that damage GRIT |

### How to play

- **Draw loops** around the creature (mouse drag or touch). Closing a loop
  with the creature inside banks one loop (pips top-left). Bank all required
  loops to wrangle it.
- **Don't touch the creature with the line** — it snaps the rope and resets
  your banked loops (no damage).
- **Watch for the red `!`** — an attack is coming. If the burst hits your
  line, you lose GRIT *and* your loops. GRIT 0 = busted.
- **Rope meter** (bottom): each loop has a length budget; it refills every
  time you close a loop. Run out mid-draw and the line breaks.
- **Releasing mid-draw** with banked loops stuns the creature briefly, but
  you can't make progress during the stun and it gets faster afterward.
- After a break you must lift and press again to start a new line.

### Tuning

Capture feel knobs are at the top of
[src/scenes/CaptureScene.ts](src/scenes/CaptureScene.ts) (rope budget, GRIT,
stun time, arena) and per-creature stats in
[src/data/species.ts](src/data/species.ts).
