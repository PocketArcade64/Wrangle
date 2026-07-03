# Wrangle

The Game Concept
A 2D mobile game blending Pokémon Ranger-style lasso-loop capturing with a western theme: a cowboy is transported from catching farm animals into an alternate dimension full of monsters. Key mechanics include touchscreen loop-drawing to capture creatures (very similar to the mechanics of Pokemon Ranger), Pokémon Rumble-style levels where your creature auto-advances toward enemies while you trigger two distinct attacks via on-screen buttons, a map screen where you drop a pin to choose where to explore, a party of three creatures that gain XP from battles, a full creature-collection page, an auction/marketplace page inspired by Virtual Pet Collector android app game made by developer Timothy S. Murphy, and a 1-in-5 chance (what does Pokemon Rumble do for chance for a pokemon to drop as a toy) to enter a capture sequence after defeating an enemy. The whole game uses a polished 16-bit retro aesthetic with fully original art and music carrying a clear western influence.
Tech Stack: Phaser
We landed on Phaser 3 (a free, open-source, MIT-licensed 2D JavaScript/TypeScript game framework) as the engine. The reasoning:

It's entirely code-based with no required visual editor, which matters because Claude Code operates through text files and terminal commands, not GUI tools — this ruled out Unity, Unreal, and Godot, where a meaningful share of the work happens in a visual editor a coding agent can't drive.
It fits your Windows-develop / Mac-final-step constraint perfectly: the entire game runs and can be tested in a browser during development, and the Mac is only needed at the very end to wrap the build with Capacitor and submit through Xcode to the App Store.
It's free for commercial use with no royalties, has built-in support for sprites, touch input, tweening, and scene management — all things your lasso mechanic, auto-battle levels, and multiple screens need — and has years of mature documentation that makes it reliable for AI-generated code.
We also discussed the newer Phaser 4 (released April 2026) but recommended sticking with Phaser 3 for now given its larger base of examples and documentation.

For persistence, we discussed layering local storage (IndexedDB or a Capacitor SQLite plugin) with a cloud backend like Supabase or Firebase — necessary in particular for the shared auction feature, since that requires a real server rather than on-device storage.
The Code Transfer Workflow
Since this Claude conversation runs on a locked-down sensitive computer (no servers, no external programs) and your actual playtesting will happen on your personal Mac, the workflow is:

One-time setup: Create a private GitHub repository. On your Mac, clone it and run npm install once.
Ongoing loop:

You give instructions to Claude here on the Windows computer
Claude Code writes/edits the game files locally in this session
Claude Code commits and pushes those changes to your GitHub repo
On the Mac, you run git pull to bring down the latest code
Vite's dev server hot-reloads automatically (or you start it with npm run dev), and you playtest in the browser
You bring feedback back to this chat, and the loop repeats


GitHub also gives you free version history, so any change Claude makes can be rolled back if needed. The one open question is whether Git itself (a lightweight command-line tool, not a server) is permitted on your work computer — if not, a shared drive (OneDrive, Google Drive, USB) zipping the project folder is the fallback, though GitHub is the cleaner option if it's available.
