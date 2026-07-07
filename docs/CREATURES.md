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
4. Drop the sprite PNG straight into `public/sprites/` — keep it named
   whatever you already call it. Leave `textureKey` blank and the game
   looks for `public/sprites/<id>.png`; if your file is named differently,
   put its exact filename (no `.png`) in the `textureKey` column, like the
   existing rows do. No sprite yet = mystery-blob placeholder.
5. Upload the changed files to GitHub as usual. Done.

Blank capture-behavior columns get gentle defaults (grazing, 3 loops,
radius 40, speed 100, no attacks), so a row with just a name and types is
immediately playable.

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
| loops | Loops to fill the capture gauge (10 pts each; base meter = 100 pts). | 10 |
| bodyRadius | Collision radius, px (sprites are ~80px, so ~40). | 40 |
| moveSpeed | Capture-arena walk speed, px/s. | 100 |
| movement | Catch behavior: `graze`, `flee`, or `charge`. | graze |
| attackPattern | `none` or `radial`. | none |
| attackIntervalMs | ms between attacks (~5000 typical). | — |
| attackDamage | **Whole health bars** removed per hit (player has 5). | 1 |
| telegraphMs | Warning time before the attack fires (~800). | 800 |
| ringMaxR / ringSpeed | Radial burst max radius (~230) / expansion px/s (~420). | 230 / 420 |
| dashIntervalMs | For `charge` movers: ms between dashes (~3500). | 3500 |
| textureKey | Exact sprite filename in `public/sprites/`, no `.png`. | uses `<id>.png` |
| blurb | Flavor text (quote it if it contains commas). | none |

## Sprite gallery

Sprites keep their original filenames in `public/sprites/`.

| dex # | name | sprite |
|---|---|---|
| 001 | Herbifuzz | ![Herbifuzz](../public/sprites/Herbifuzz_80x80.png) |
| 002 | Telefluff | ![Telefluff](../public/sprites/Telefluff_80x80_80x80.png) |
| 003 | Bloomancer | ![Bloomancer](../public/sprites/Bloomancer_80x80_80x80_80x80.png) |
| 004 | Flambaa | ![Flambaa](../public/sprites/Flambaa_80x80.png) |
| 005 | Shearfire | ![Shearfire](../public/sprites/Shearfire_80x80_80x80.png) |
| 006 | Ramageddon | ![Ramageddon](../public/sprites/Ramageddon_80x80.png) |
| 007 | Narqua | ![Narqua](../public/sprites/Narqua_80x80.png) |
| 008 | Narstream | ![Narstream](../public/sprites/Narstream_80x80.png) |
| 009 | Aquarion | ![Aquarion](../public/sprites/Aquarion_80x80_80x80.png) |
| 010 | Chipper | ![Chipper](../public/sprites/Chipper_80x80.png) |
| 011 | Chipunk | ![Chipunk](../public/sprites/Chipunk_80x80.png) |
| 012 | Fuzzark | ![Fuzzark](../public/sprites/Fuzzark_80x80_80x80-2.png) |
| 013 | Cocoonir | ![Cocoonir](../public/sprites/Cocoonir_80x80.png) |
| 014 | Mothrae | ![Mothrae](../public/sprites/Mothrae_80x80.png) |
| 015 | Mothrax | ![Mothrax](../public/sprites/Mothrax_80x80.png) |
| 016 | Picodew | ![Picodew](../public/sprites/Picodew_80x80.png) |
| 017 | Nanodrop | ![Nanodrop](../public/sprites/Nanodrop_80x80.png) |
| 018 | Microsplash | ![Microsplash](../public/sprites/Microsplash_80x80.png) |
| 019 | Toxnome | ![Toxnome](../public/sprites/Toxnome_80x80.png) |
| 020 | Gnomore | ![Gnomore](../public/sprites/Gnomore_80x80-3.png) |
| 021 | Peafolia | ![Peafolia](../public/sprites/Peafolia_80x80.png) |
| 022 | Floracox | ![Floracox](../public/sprites/Floracox_80x80.png) |
| 023 | Aquarix | ![Aquarix](../public/sprites/Aquarix%20(Male)_100x100.png) (also a [female variant](../public/sprites/Aquarix%20(Female)_80x80-2.png), unused for now) |
| 024 | Froxic | ![Froxic](../public/sprites/Froxic_80x80.png) |
| 025 | Venaura | ![Venaura](../public/sprites/Venaura_80x80.png) |
| 026 | Frogue | ![Frogue](../public/sprites/Frogue_80x80.png) |
| 027 | Pyrotox | ![Pyrotox](../public/sprites/Pyrotox_80x80.png) |
| 028 | Ranion | ![Ranion](../public/sprites/Ranion_80x80.png) |
| 029 | Amphivolt | ![Amphivolt](../public/sprites/Amphivolt_80x80.png) |
| 030 | Bulboak | ![Bulboak](../public/sprites/Bulboak_80x80.png) |
| 031 | Sapotox | ![Sapotox](../public/sprites/Sapotox_80x80.png) |
| 032 | Ribitta | ![Ribitta](../public/sprites/Ribitta_80x80.png) |
| 033 | Amphivy | ![Amphivy](../public/sprites/Amphivy_100x100-2.png) |
| 034 | Shrimpulse | ![Shrimpulse](../public/sprites/Shrimpulse_80x80.png) |
| 035 | Shrimlock | ![Shrimlock](../public/sprites/Shrimlock_80x80.png) |
| 036 | Shrimpire | ![Shrimpire](../public/sprites/Shrimpire_80x80_80x80.png) |
| 037 | Gronder | ![Gronder](../public/sprites/Gronder_80x80.png) |
| 038 | Shadire | ![Shadire](../public/sprites/Shadire_80x80.png) |
| 039 | Rodentia | ![Rodentia](../public/sprites/Rodentia_80x80.png) |
| 040 | Swordine | ![Swordine](../public/sprites/Swordine_80x80-2.png) |
| 041 | Marlash | ![Marlash](../public/sprites/Marlash_90x90.png) |
| 042 | Selkie | ![Selkie](../public/sprites/Selkie_80x80.png) |
| 043 | Humminga | ![Humminga](../public/sprites/Humminga_80x80.png) |
| 044 | Nectara | ![Nectara](../public/sprites/Nectara_80x80.png) |
| 045 | Volaris | ![Volaris](../public/sprites/Volaris_80x80.png) |

Staged for later (not yet in the dex): [Mega Bloomancer](../public/sprites/Mega%20Bloomancer_80x80.png),
[Mega Ramageddon](../public/sprites/Mega%20Ramageddon_80x80.png).
