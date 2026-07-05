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


______________

Mobile game that uses same gameplay catching like Pokemon Ranger 
- Make loops on touch screen to fill a meter to capture creatures
- Instead of styler like in Pokemon, you are a cowboy that uses a lasso
    - Cowboy transported to future or alternate dimension
- Tutorial is catching farm animals until you are transported to alternate reality with monsters
- Maybe implement ideas from Virtual Pet Collector game from Android phone (auction page for creatures, click on square boxes to enter areas) 
- Maybe have levels similar to Pokemon Rumble and be procedurally generated 
- How will I able to store user specific progress for each different user? Is this possible in HTML?

Use font Silkscreen for all the text in the game

Maybe use this to animate the sprites: https://www.spritefusion.com/pixel-art-generator
OR https://www.autosprite.io

Final Name: Wrangle
(Unused Names: Looper?, Cowboy Craze, Rancher Revolution, Looper: Lasso Legacy, Looper: Lasso League)

Game Details:
- The game has a polished 16 bit retro aesthetic with all assets created originally and not sourced from anywhere online
    - Original music that is calming with clear western influence (the music changes depending on the area)
- When in a level, your creature moves forward automatically towards enemies and there are 2 buttons on the bottom of the screen and you click each one for a different attack (only 1 button if our creature is a single type)
    - Each creature is either a physical or special attacker
    - Each create caught has random IVs
- There is a daily login bonus and a wheel you can spin daily
    - If you watch an ad you can spin a wheel with worse rewards endlessly
- When you want to enter a level, there is a map and you drop a pin where to want to explore 
    - There is stamina that refreshes hourly to pick a new location, but you can revisit your last 3 locations endlessly (you can mark a location as a favorite to not loose it, your new explorations do not overwrite that location)
        - Each location has randomly placed monsters but the locations monsters spawn are fixed
- You can bring 3 monsters into a level and they gain XP with each monster they defeat (there is a saved teams button so you can select your favorites)
    - There is a section in the menu where you can see all your monsters and this menu looks like the pokemon go screen where you see all your creatures
- When you defeat an enemy, there is a chance (1/5?) that the lasso mini game begins to capture it
- Maybe add an auto button that picks moves for you?
- You can equip 1 items to each of your monsters (these items are bought in the shop)
    - There are also limited time use items that last 30 min or so and give you various boosts
- Every monster you defeat drops currency but more currency if you capture it

_____________

Loop mechanics

Core mechanics

The line and loops
	•	Player drags a stylus/cursor to draw a continuous “capture line.” It has a max length budget (in pixels/units), tracked as it’s drawn.
	•	When the line crosses back over itself with the target Pokémon enclosed, that counts as one completed loop. The used length resets and a new segment starts from that same point.
	•	Each Pokémon has a required loop count (weak Pokémon: 2-3 loops, legendaries: much higher).
	•	Total line length is fixed per Styler upgrade level, and the sum of the circumference of all required loops can’t exceed that budget — so bigger Pokémon needing more/larger loops force you to draw tight, efficient circles.

Breaking the line

	•	If the Pokémon’s body touches the line while you’re drawing it, the line breaks immediately and your loop progress resets to zero  — pure collision, no damage.
	•	Separately, the Pokémon telegraphs an attack: a cry sound + exclamation mark appears above it a beat before the attack fires. If the attack (not just the body) connects with the line, it both breaks the line AND damages the Styler’s HP.
	•	Simple collision with the body does not cost HP — only attacks do.  This distinction is what makes the game skill-based: bumping the line is just annoying, getting hit is dangerous.
	•	If Styler HP hits 0, it’s game over / return to last checkpoint.

Player-side failure states

	•	If the player releases the input mid-line before closing a loop, the line vanishes. If some loops were already banked, the Pokémon is briefly stunned — but this stun doesn’t let you make progress while it’s active, and once it ends the Pokémon becomes harder to pin down again.  This is a deliberate anti-cheese mechanic: you can’t spam release/redraw for free safety.

Movement/attack patterns

	•	Each species has a distinct movement pattern (straight charge, curve, teleport/counter a la Wobbuffet, sleeping/stationary) and an attack pattern (projectile, radial burst, melee lunge). Difficulty is tuned per-species by pattern speed/size, not just loop count.

Rebuilding it — suggested architecture
target = {
  requiredLoops: int,
  loopsRemaining: int,
  lineBudgetTotal: float,      // resets on upgrade, not per-attempt
  lineBudgetUsed: float,       // resets to 0 each loop
  currentLinePoints: [],       // active drawn polyline
  isAttacking: bool,
  attackTelegraphTimer: float, // exclamation-mark warning window
  stunTimer: float,
}

Per-frame loop:

	1.	Input phase — while pointer/stylus is down, append points to currentLinePoints, accumulate lineBudgetUsed by segment length.
	2.	Self-intersection check — each new segment, test against all prior segments in the current line for intersection. If found, and the target’s position is inside the polygon formed by the loop → loop complete: decrement loopsRemaining, reset currentLinePoints to a fresh start point, reset lineBudgetUsed (or don’t, if budget is cumulative in your design — original resets per loop, not per attempt).
	3.	Collision check (every frame while drawing) — test the target’s collider against every segment of currentLinePoints. On overlap: clear the line, reset loopsRemaining to full, no HP loss.
	4.	Attack telegraph — on a timer/AI trigger, set isAttacking = true, play cue, spawn the actual hazard (projectile/hitbox) after a fixed warning delay (~0.5-1s is a good feel target).
	5.	Attack collision check — if the live line intersects the attack hitbox: clear line + reset loops (same as body collision) AND subtract HP from Styler.
	6.	Release-before-close — if input lifts with an incomplete loop: discard partial line; if loopsRemaining < requiredLoops (i.e., some loops already banked), apply a short stun to target, but explicitly block loop-progress logic during the stun window so it can’t be exploited as free safety.
	7.	Overflow check — if lineBudgetUsed exceeds remaining budget mid-draw, force-break the line (you ran out of “ink”).
	8.	Completion — when loopsRemaining == 0, trigger capture success (and optionally reward bonus for extra completed loops before finishing, which was used in the original for arena score/energy bonuses).

Upgrading

Points are then spent on a menu of named stats: max styler energy, styler power, max line length, decreased damage, decreased charge time, increased styler energy gained after each capture, and increased power when health is low.
	•	Crucially, each stat can be leveled up repeatedly toward a max, but higher levels cost progressively more points  — classic diminishing-returns skill investment, giving the player real build choices instead of a fixed progression path.

Maybe use? - 	Also introduces Styler Power (friendship conveyed per loop) as a new upgrade axis alongside Energy — this replaces the old raw line-length-only progression since the capture mechanic itself changed here (friendship gauge you fill over time, rather than a hard loop counter — you can lift the stylus without penalty, but the gauge decays if you stop drawing for too long).

____________

- Can you create a file that succinctly explains what you accomplished in each update iteration of making the game in a text file and each time you check the GitHib repo to see where you left off.
- Also while building, please create instructions in a text file teaching Claude Opus 4.8 how to think more efficiently and productively with tips you specifically learned when working on this project. 

- Add my custom Wrangle sprites 
- Ask Claude how to build a scalable system like an excel sheet where I can keep adding creatures in the future and the spreadsheet tracks their types and other relevant gameplay behavior (like aggressiveness when catching)
