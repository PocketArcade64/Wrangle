# Wrangle — Creature Registry

**Single source of truth: [src/data/creatures.csv](../src/data/creatures.csv)** —
a real spreadsheet you can open and edit directly in Excel, Numbers, or Google
Sheets. The game parses it automatically at build time
([src/data/species.ts](../src/data/species.ts) does the parsing/validation);
no code changes are needed to add a creature.

**Row order in the CSV = dex order in the game.**

## How to add or edit a creature

1. Open `src/data/creatures.csv` in Excel/Numbers/Sheets.
2. Add or edit a row (columns below). Only `name` (or `id`) is truly
   required — every other column can be filled in later.
3. **Save it back as CSV** (in Excel: "CSV UTF-8" — keep the `.csv`
   extension, don't let it convert to `.xlsx`).
4. Upload the changed CSV to GitHub as usual. Done.

Blank capture-behavior columns get gentle defaults (grazing, 3 loops,
radius 40, speed 100, no attacks) and the mystery-blob placeholder sprite,
so a row with just a name and types is immediately playable.

If a row has a mistake (typo'd value, text where a number belongs), the game
shows a descriptive error naming the creature and column — check the browser
console / Vite error overlay.

## Columns

| Column | Meaning | Blank = |
|---|---|---|
| id | Lowercase unique id. | Derived from name (letters/digits only) |
| name | Display name. | Required (or id) |
| type1 / type2 | Elemental types — used by battles from M3. type2 blank for mono-types. | none |
| hp / attack / defense / spAttack / spDefense / speed | Battle base stats (M3). | TBD |
| atkStyle | `physical` or `special` — which battle moveset it gets (M3). | TBD |
| loops | Loops to fill the capture gauge. | 3 |
| bodyRadius | Collision radius, px (placeholders are ~30-46). | 40 |
| moveSpeed | Capture-arena walk speed, px/s. | 100 |
| movement | Catch behavior: `graze`, `flee`, or `charge`. | graze |
| attackPattern | `none` or `radial`. | none |
| attackIntervalMs | ms between attacks (~5000 typical). | — |
| attackDamage | **Whole health bars** removed per hit (player has 5). | 1 |
| telegraphMs | Warning time before the attack fires (~800). | 800 |
| ringMaxR / ringSpeed | Radial burst max radius (~230) / expansion px/s (~420). | 230 / 420 |
| dashIntervalMs | For `charge` movers: ms between dashes (~3500). | 3500 |
| textureKey | Sprite key. Later: PNGs in `public/sprites/<id>.png`. | mystery blob |
| blurb | Flavor text (quote it if it contains commas). | none |

## Sprite gallery

All 45 creatures currently use the generated mystery-blob placeholder. As
real pixel-art PNGs land in `public/sprites/`, link them here for easy
reference (GitHub renders the images inline):

| dex # | id | sprite |
|---|---|---|
| 001 | herbifuzz | *(placeholder)* |
| ... | ... | *(placeholder)* |
| 045 | volaris | *(placeholder)* |
