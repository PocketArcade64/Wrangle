# Wrangle — Creature Registry

**Single source of truth: [src/data/creatures.csv](../src/data/creatures.csv)** —
a real spreadsheet you can open and edit directly in Excel, Numbers, or Google
Sheets. The game parses it automatically at build time
([src/data/species.ts](../src/data/species.ts) does the parsing/validation);
no code changes are needed to add a creature.

## How to add a creature

1. Open `src/data/creatures.csv` in Excel/Numbers/Sheets.
2. Add a row (columns below). Leave attack columns blank for harmless
   creatures.
3. **Save it back as CSV** (in Excel: "CSV UTF-8" — keep the `.csv`
   extension, don't let it convert to `.xlsx`).
4. Drop the sprite PNG into `public/sprites/<id>.png` and put its key in the
   `textureKey` column (real sprite loading lands with the art pass — current
   placeholder keys are `pl-cow`, `pl-chicken`, `pl-dust`).
5. Upload the changed CSV to GitHub as usual. Done — the creature appears in
   the game.

If a row has a mistake (typo'd column, non-number where a number belongs),
the game shows a descriptive error naming the creature and column — check
the browser console / Vite error overlay.

## Columns

| Column | Required | Meaning |
|---|---|---|
| id | yes | Lowercase internal id, must be unique (e.g. `bessie`) |
| name | no | Display name (defaults to id uppercased) |
| type | no | Elemental type — tracked now, used by battles in M3 |
| atkStyle | no | `physical` or `special` — battle system (M3) |
| loops | yes | Loops required to fill the capture gauge |
| bodyRadius | yes | Collision radius in px (placeholder sprites are ~30-46) |
| moveSpeed | yes | Base walk speed, px/s |
| movement | yes | Catch behavior: `graze`, `flee`, or `charge` |
| attack | yes | `none` or `radial` |
| attackIntervalMs | if attacking | ms between attacks (~5000 typical) |
| attackDamage | if attacking | **Whole health bars** removed per hit (player has 5) |
| telegraphMs | if attacking | Warning time before the attack fires (~800) |
| ringMaxR | if radial | Burst max radius, px (~230) |
| ringSpeed | if radial | Burst expansion speed, px/s (~420) |
| dashIntervalMs | if charge | ms between dashes (~3500) |
| textureKey | yes | Sprite key (later: `public/sprites/<id>.png`) |
| blurb | no | Flavor text shown on the target-select card |

## Sprite gallery

Placeholder art is runtime-generated for now. As real pixel-art PNGs land in
`public/sprites/`, link them here for easy reference:

| id | sprite |
|---|---|
| bessie | *(placeholder, generated)* |
| pecksy | *(placeholder, generated)* |
| dustdevil | *(placeholder, generated)* |
