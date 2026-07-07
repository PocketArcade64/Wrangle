# Wrangle — session instructions for Claude

Start every session by reading **DEVLOG.txt** (where work left off) and
**docs/OPUS_TIPS.txt** (hard-won practices for this project). Append a new
DEVLOG.txt entry (newest on top) after each completed iteration.

Hard rules:
- No Node.js on this machine and none can be installed — code cannot be run
  or compiled here. Write compile-safe strict TypeScript on the first try.
- Never create README.md (user maintains their own on GitHub). The project
  guide is GUIDE.md.
- Never commit/push — the user manually uploads changed files to their
  GitHub repo and playtests on their Mac. End each iteration by listing
  exactly which files changed.
- Creature/content data is data-driven: creatures live in
  src/data/creatures.csv (user-editable spreadsheet, parsed/validated by
  src/data/species.ts). Column docs in docs/CREATURES.md.
- Design reference: docs/GAME_DESIGN.md — its "UI design system" section is
  CANON: apply it to every screen without being asked (pixel art, NO rounded
  corners/gradients/glow, clay = only accent, brass = currency only, western
  frontier grounding, min readable text ~18-20 logical px). Milestones:
  docs/ROADMAP.md.
