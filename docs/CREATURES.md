# Wrangle — Creature Registry

**Single source of truth for gameplay data: [src/data/species.ts](../src/data/species.ts).**
The game reads only that file. This document is the human-friendly spreadsheet
view of it — keep the two in sync (Claude updates both whenever a creature is
added or changed).

## How to add a creature

1. Drop the sprite PNG into `public/sprites/<id>.png` (e.g.
   `public/sprites/bessie.png`). Vite serves `public/` as-is and GitHub
   renders the image links below.
2. Add an entry to `SPECIES` in `src/data/species.ts` filling in the columns
   below. No scene code changes needed — behavior comes from the
   `movement` / `attack` pattern fields, so new creatures are pure data.
3. Add a row to the table here with the sprite link.

If a creature needs a behavior that doesn't exist yet (new movement or attack
pattern), that pattern gets implemented once in `CreatureActor.ts` /
`CaptureScene.ts` and then becomes available to every future creature.

## Columns

| Column | Meaning |
|---|---|
| id / name | Internal id (lowercase) and display name |
| sprite | Link to the PNG in `public/sprites/` |
| type | Elemental/creature type (drives battle matchups — schema arrives with M3 battles) |
| atk style | `physical` or `special` (which battle button/moveset it gets) |
| loops | Loops required to capture |
| aggressiveness | Attack pattern + how often: `none`, or pattern + interval/damage |
| catch behavior | Movement pattern while being lassoed: `graze`, `flee`, `charge` (more patterns in M2: sleep, teleport, lunge...) |
| speed | Base movement speed, px/s |

## Roster

Current sprites are runtime-generated placeholders (no PNG files yet) — the
sprite column will point at real files as the original pixel art lands.

| id | name | sprite | type | atk style | loops | aggressiveness | catch behavior | speed |
|---|---|---|---|---|---|---|---|---|
| bessie | BESSIE | *(placeholder, generated)* | normal (TBD) | physical (TBD) | 2 | none | graze — wanders slowly, pauses | 60 |
| pecksy | PECKSY | *(placeholder, generated)* | normal (TBD) | physical (TBD) | 3 | none | flee — runs from your finger within 280px | 150 |
| dustdevil | DUSTDEVIL | *(placeholder, generated)* | earth (TBD) | special (TBD) | 4 | radial burst every ~5s, 25 GRIT dmg | charge — periodic dashes at your finger | 110 |

*(TBD) fields are placeholders until the type chart and battle system (M3)
define the real values — the species.ts schema gains `type` and `atkStyle`
fields at that point.*
