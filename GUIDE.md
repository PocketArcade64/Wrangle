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
| PECKSY (hen) | 3 | Flees your finger/cursor |
| DUSTDEVIL | 4 | Charges at you and fires radial bursts that damage HEALTH |

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
- Releasing the line just drops it — no penalty. After a break you must lift
  and press again to start a new line.

### Tuning

Capture feel knobs are at the top of
[src/scenes/CaptureScene.ts](src/scenes/CaptureScene.ts) (line width, health
bars, gauge decay delay/rate). Per-creature stats live in the spreadsheet
[src/data/creatures.csv](src/data/creatures.csv) — editable in Excel; column
reference in [docs/CREATURES.md](docs/CREATURES.md).
