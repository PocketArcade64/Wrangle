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

_____________

Act as a world-class pixel art video game brand identity designer. I am creating my own take on a Pokemon Ranger video game but legally distinct and uses a lasso instead. Create a pixel art logo for "Wrangle" that communicates the lasso premise and targets pixel art video game enthusiasts. Style should feel premium, timeless, and globally recognizable. Avoid trends focus on longevity. The logo is just the word Wrangle but stylized with a lasso (the lasso rope fully connects and is not just segmented). Make the background green screen and include a a thin black border around the logo. Focus on its pixel art identity and western style font. Make one of the letters form into a throwing lasso

__________________

whole game menu structure working like an award winning polished finalized app project. Remember the game is all pixel art themed so there should no NO rounded edges at all - all custom made pixel art. Grounding it in the subject: 
This isn't a generic monster-collector. It's specifically a western frontier one: lassos instead of pokéballs, calming twangy scores, dusty exploration by dropped map pins. Every design choice below leans into that instead of defaulting to "Pokémon-with-different-colors."
One naming idea before the palette: your "?" tab is begging to be Bounties instead of a mystery icon. In-world, that's a wanted-poster board — daily quests/challenges. It's more legible than a question mark and it's free thematic reinforcement. I'll design around that; tell me if "?" meant something else (events, notifications, help).
Color — named, not default
Avoiding the AI-slop defaults (cream+terracotta, black+neon, gem-sparkle gacha colors). A sun-worn, screen-printed-poster palette:
TokenHexRoleparchment#E8D9B5Base background — aged paper, not stark whitesaddle#7A4A2BStructural — frames, nav bar, bordersclay#C1652FThe one accent — Explore CTA, active statessage#7C8B6FCalm secondary — stamina, passive UIdusk-denim#3F5C6CCool counterpoint — water biome, special-attack tintink#2B221ATextbrass#B8912ACurrency only — reserved so it stays meaningful
Restraint rule: clay is the only "loud" color, used only for the Explore button and the active nav tab. Brass is reserved for currency only, so it never dilutes into generic "gold UI" gloss. No gradients, no glow — flat fills read as more premium in a pixel-art context anyway; glow/gradient is what makes free-to-play games look cheap.
Typography
Two bitmap-style faces, not three, and no default pixel font (Press Start 2P is the "AI slop" tell of retro game UI):
Display — a chunky stencil/branding-iron bitmap face for headers and the logo (think cattle-brand, not arcade font)
UI/body — a plainer, tighter pixel-grid sans for numbers, labels, nav — has to stay legible at small mobile sizes, so it's less stylized than display
Currency/stamina numbers use tabular pixel digits so they don't jitter as they tick up
Layout concept
Three horizontal zones + persistent nav, one CTA, nothing competing for attention on load:
The signature element is that diorama panel: instead of a static logo or a generic grid of buttons, it's a small parallax postcard of wherever you last explored — the actual biome art, your lead creature standing in it idle-animating, framed like a wood-bordered photograph. It's the one place I'd spend "boldness" — everything else stays quiet and functional. It also does real work: it's a preview of what "Explore" will drop you into, and it changes with the region music, so home screen and gameplay feel like one continuous world instead of a menu bolted onto a game.
What keeps this from feeling like slop
No forced popup on launch (daily wheel becomes a badge dot on a satchel icon — opened on tap, not shoved in your face)
No red "urgency" numerals on stamina/timers — sage, not red, since running low isn't a failure state
Exactly one saturated color (clay) so the eye knows what's actionable
Nav icons are flat single-color glyphs in saddle, active tab gets clay — no glossy 3D button chrome
No gem-currency sparkle treatment on brass counters

_____________________

_________________________
Updates 

- Does this current build reflect how it will look like exactly as an app because there is a black bar at the top of my iPhone by the Dynamic Island 
    - How will the iPhone Pro with a bigger screen work (will the elements scale to size (that would be good) or will there be empty space - not preferable)

- figure out type chart and which types I will use
    - Design the type icons and word icons

- Make the title screen be a pixel art sun that reflects the current time of day corresponding to tour real time (sunset/sunrise and dark moon implemented) with random critters you have seen walking around)

- There is a bounty board (Challenges) that rewards you based on challenges you complete and creatures you turn in. 
    - Make some challenges require multiple pokemon (only if basic or stage 1) this posters are a little bigger and have a progress bar that fills in when you turn in a reward. 
    - Make the bounty board show ??? If you have not seen that critter yet and show their name if you have encountered them before. 
    - Below the creature turn in section have other daily challenges related to the game
    - The critters on the bounty board are guaranteed to be found in the areas you explore that day - if you click close to a coordinate it forces a click on a close one that has that critter species (only does this until they are first seen that day)
        - The Pokemon found on the maps in Coordinates change daily (like Pokemon Rumble Rush)
    - You must catch a creature that day to be able to turn it in the bounty board
- Add a menu to upgrade your lasso
    - Make lasso look more like the logo
    - redo bar under the pokemon to be western stylized
    - Add a charge upgrade to lasso?
- Make the user pick a profile icon and gain XP based on captures 
- When you click explore show a map with coordinates that determines your stage and changes daily - at the top are different tabs that cost coins to unlock new maps
- Creatures dex reveals more details like Pokédex entry, weaknesses, resistance and more depending on how many you capture/obtain for each species
- Make app icon have 3 starters with a pixel art sunset western cactus background then stylized Wrangle below

- Pokédex is Frontier Ledger
- Pokemon are Critters (multiple are a herd) ✅ 
- Record the design philosophy wording I used when first building the UI to replicate later on ‼️ 

- Make the critters never touch the edge of the screen because when they do that you cannot lasso them

Lasso refinements: 
- Consecutive loop bonus that boosts your lasso bower after you land 5 consecutive loops
- Each loop shows a number how much damage you added to that critter’s capture meter

Critter menu:
- Critters that are favorited cannot be turned in for bounties or put up for auction
- In your player menu have a section for showcase and those critters are the ones that walk around on the title screen
- Details shows where can be found


- add a developer menu (will get removed later) that there are buttons to play test features and codes to enter to test features

Later additions:
- Critter assist like Poke Assists from Pokemon Ranger guardian signs
- Each critter can be deployed and use a move to help and they can be resummoned infinitely until hit in each battle 
- The assists fill the capture meter below the pokemon but you need to do a loop to deal the final 1 capture point to finish the meter
- Critters of the same type have different moves so you can pick one over the other
- Show type icons stacked vertically to the right of each critter in the Posse menu to indicate which moves they know (in the future I will add more moves and allow move changing)
- 	- Make physical/special icon variations for each type

- The tutorial in a standard ranch that explains the basic concepts. Then, you get teleported to an alternate dimension and choose your first starter

____________________________

here is the full type chart. Add a quick view button on the herd individual creatures page, individual ledger page near the restistances and also under the how to play button in the player's profile.
Type	Strong vs (2x)	Weak vs (0.5x)	Vulnerable to (takes 2x)	Immune to
Fire	Grass, Frost, Metal, Bug	Fire, Water, Earth, Dragon	Water, Earth, Fire	—
Water	Fire, Earth	Water, Grass, Dragon	Grass, Lightning	—
Grass	Water, Earth	Fire, Grass, Frost, Poison, Bug, Metal, Dragon, Air	Fire, Frost, Poison, Bug, Air	—
Lightning	Water, Air	Grass, Lightning, Dragon	Earth	—
Earth	Fire, Lightning, Poison, Metal	Grass (resist, not weak), Bug	Water, Frost	Lightning
Air	Grass, Fighting, Bug	Lightning, Metal	Lightning, Frost, Earth	—
Dark	Psychic, Ghost	Dark, Fighting, Mystical	Fighting, Bug, Mystical	Psychic
Psychic	Fighting, Poison	Psychic, Metal, Dark	Bug, Ghost, Dark	—
Ghost	Psychic, Ghost	Dark	Ghost, Dark	Normal, Fighting
Metal	Frost, Mystical, Earth	Fire, Water, Lightning, Metal	Fire, Fighting, Earth	Poison
Mystical	Fighting, Dragon, Dark	Fire, Poison, Metal	Poison, Metal	Dragon
Normal	—	—	Fighting	Ghost
Fighting	Normal, Frost, Earth, Metal, Dark	Air, Psychic, Mystical, Bug	Air, Psychic, Mystical	—
Poison	Grass, Mystical	Poison, Earth, Ghost, Fire	Earth, Psychic	—
Bug	Grass, Psychic, Dark	Fire, Fighting, Poison, Frost, Ghost, Air, Metal	Fire, Air, Frost	—
Frost	Grass, Earth, Air, Dragon	Fire, Water, Frost, Metal	Fire, Fighting, Metal	—
Dragon	Dragon	Frost, Dragon	Frost, Mystical, Dragon	—

Also add a pixel art daily login bonus (like a stamp hole punch card but make it western themed)
and a wheel you can spin daily
    - If you watch an ad you can spin a wheel with worse rewards endlessly

Frontier Flats
* Sunny prairie (Normal, Grass)
* Flower fields (Grass, Bug)
* Small river and ponds (Water)
* Windmill ranch (Normal)
* Oak grove (Grass)
* Rocky creek (occasional Earth)
* Wooden bridges and fences connecting everything together

Gameplay Loop (Inspired by the structure of Pokémon Rumble Rush, but with original mechanics)
Tap Explore to open the world map.
Tap any location on the map to drop a pin. The pin's coordinates generate a unique stage with different critter spwans. (the coordinate system changes daily)
The coordinates determine the stage's biome/theme, available hazards, and the pool of critters that can appear.
Each stage contains predefined spawn locations, but an RNG seed decides which critter species occupy each spawn group, making every generated stage unique while preserving level layout.
Critters appear in groups of the same species. Occasionally, a rare variant or rarer species appears in the center of a group.
Progress through the stage by clearing encounters until reaching the boss at the end.
Completing a stage permanently saves its generated seed. Players can store up to 3 pinned stages and replay them infinitely without spending stamina. (you can mark a single location as a favorite to not lose it, your new explorations do not overwrite that location)
Creating a new pin consumes stamina and replaces one of the stored stage slots if all three are occupied.
When a player encounters a critter for the first time, a small notification slides in on the left side of the screen showing:
Critter icon/sprite
Critter name
Type(s)
NEW badge
Newly discovered critters are immediately added to the player's Field Guide (or equivalent encyclopedia), encouraging exploration of new coordinates to complete the collection.
if you come across a critter group you have seen before still show Critter icon/sprite, Critter name, Type(s) 
Different coordinates should produce meaningful variation through biome, encounter tables, boss selection, environmental hazards, and collectible rewards, giving players a reason to continually explore new locations instead of replaying the same stages. controls during a stage: exactly like Pokemon Rumble Rush (with some minor changes)- When in a level, your critter moves forward automatically towards enemies and there are 2 buttons on the bottom of the screen and you click each one for a different attack (only 1 button if our creature is a single type) the buttons reflect cooldown to indicate when you can use a move again. Each creature is either a physical or special attacker and has the corresponding moves (I will add in more moves later). you can swipe to make the critter reposition itself (just like in Rumble Rush). You can bring 3 critters into a level and they gain XP with each monster they defeat (add levels like in pokemon with max 100 and add their level and xp bar in the herd menu when you click on a critter)

Moves (I will imlement more later) - for each each type has 1 physical and 1 special
Every move has a hitbox shape that's mechanically unique — arcs, cones, lines, circles, spreads, dash-hitboxes, delayed-attach orbs, and a stationary cloud — so even two "melee" moves like Burning Lash and Riptide Slam read completely differently in motion. There should be a clear different feel betwene physical and special moves too.

Fire
Physical – Burning Lash (short forward-facing whip arc, melee range) A whip-crack hitbox that arcs in front of the user. Sets target burning — steady damage over 4 seconds. Fast cooldown, but you must be close. Special – Wildfire Lob (arcing lobbed projectile that splashes into a ground-fire patch on impact) Travels in a visible arc and, on landing, leaves a burning patch on the ground for 3 seconds. Anything that touches the patch burns. Slow travel time, dodgeable mid-air.
Water
Physical – Riptide Slam (small frontal shockwave cone, melee) A short cone-shaped knockback hitbox — no status, just displaces the target (and anything behind it) a set distance. Great for repositioning, no damage-over-time. Special – Flash Flood (wide slow-moving wave that travels forward in a straight line) A tall wall-shaped hitbox that moves slowly across the ground. Anything caught becomes "soaked," taking bonus damage from Lightning for a few seconds. Easy to outrun if you're fast.
Grass
Physical – Bramble Lasso (single-line tether that shoots straight out and snags the first target it touches) A thin, long-range line hitbox (not an area) — hits one target and roots them in place 1.5 seconds. Low direct damage; it's a lockdown tool, not a hitter.
Special – Bloomburst (lobbed seed-pod projectile that explodes into a radial burst on impact or after a short delay)
An arcing lob hitbox — travels like Fire’s Wildfire Lob but instead of leaving a lingering patch, it detonates once into a circular burst hitbox on landing (or after 2 seconds if it hits open ground). Deals a solid one-time hit of damage with no damage-over-time attached, since Bramble Lasso already owns the “control/DoT-adjacent” niche for the type. The tradeoff is the visible telegraph — the pod is a slow, arcing object enemies can see coming and step out from under before it lands.
Lightning
Physical – Live Wire Jab (tiny point-blank melee poke, with a secondary small chain-arc hitbox to the nearest neighbor) Weak single-hit hitbox at melee range that, on contact, spawns a secondary small arc hitbox to one nearby enemy for reduced damage. Only ever chains once. Special – Overcharge Bolt (thin, long-range straight beam with a brief wind-up telegraph) A narrow line hitbox that travels the full length of the arena. Visibly telegraphed before firing, giving alert enemies a window to step out of line.
Earth
Physical – Canyon Crush (circular ground-slam radius centered on the user) A circle hitbox around the user's own position, hitting everything adjacent. Long recovery animation after, leaving the user briefly exposed. Special – Dust Reckoning (wide, expanding cone-shaped dust cloud fired forward) A cone hitbox that expands with distance. Deals minimal damage but lowers accuracy of everything caught inside for a few seconds — a control tool, not a damage tool.
Air
Physical – Talon Dive (a dash-line hitbox — the user physically dashes forward and any enemy on that line is hit) The user becomes the hitbox, dashing in a fixed straight line. Cannot be redirected mid-dash, so positioning before use matters a lot. Special – Gale Herd (short wide cone directly in front of the user) A short, wide cone hitbox that hits and knocks back everything inside — good against groups, but the cone's short range means you need to already be close.
Dark
Physical – Backalley Bite (small melee hitbox that only registers bonus effect if it lands on the target's back-facing side) Same small melee hitbox as a normal bite, but the game checks the target's facing direction on hit — striking their back deals bonus damage, striking their front doesn't. Special – Shadow Bounty (a teleport-strike: the user blinks to a fixed short distance behind the nearest enemy and the hit registers there) The hitbox appears at the destination point behind the target, not in front of the user. Long cooldown, and there's a brief vulnerable window right after the teleport resolves.
Psychic
Physical – Mindspur Strike (narrow melee jab hitbox) Small, precise melee hitbox with a chance to scramble the target's controls for ~1 second (reversed movement/attack input). Doesn't stack on the same target. Special – Farsight Pulse (three small orbs fired in a fixed spread pattern directly ahead — left, center, right) Three separate small projectile hitboxes launched simultaneously in a fan. Each orb does very low individual damage but the spread makes it hard to fully dodge — reliable chip damage, no burst potential.
Ghost
Physical – Grave Grapple (short-range hitbox that ignores solid obstacles/cover in front of the user) A short melee-range hitbox that can register through walls or cover (the strike "phases"). Very short effective range makes it risky. Special – Wailing Curse (slow-drifting orb that doesn't disappear on contact — it attaches to the target as a marker) A slow-moving projectile hitbox that, on touching a target, attaches a curse marker instead of dealing immediate damage. Damage triggers automatically 3 seconds later regardless of what the target does. The orb itself is slow and can be sidestepped before it lands.
Metal
Physical – Rivet Ram (small frontal shoulder-check hitbox, melee) A compact frontal hitbox with below-average damage, but grants the user a brief damage-reduction shield on hit. Trades offense for survivability. Special – Shrapnel Volley (short-range spread of multiple small pellet hitboxes that fan out and lose density with distance) Several small pellet hitboxes fired in a spread — dense and effective up close, sparse and unreliable at range.
Mystical
Physical – Charmspur Kick (single melee hitbox, low knockback) Standard melee hitbox with a chance to cause the target to not attack Special – Lucky Star Waltz (a single homing projectile that curves gently toward the target) One slow, mildly homing projectile hitbox — hard to fully whiff but easy to outrun. Higher-than-normal critical chance on contact.
Normal
Physical – Roundup Tackle (generous, forgiving melee hitbox directly ahead) The most forgiving hitbox shape in the game — wide melee arc, short cooldown, no gimmick. The reliable baseline move. Special – Echoing Holler (small radial burst centered on the user) A small circular burst hitbox around the user that briefly lowers enemy attack power within it. Doesn't expand or travel — ineffective against spread-out enemies.
Fighting
Physical – Iron Grip Toss (point-blank grapple hitbox — must be directly adjacent, no forward range at all) The smallest hitbox in the game, essentially requiring the user to be standing on top of the target. Whiffs completely at any distance, but stuns on hit. Special – Focused Roar (long, thin, guaranteed-tracking line hitbox) A line hitbox that subtly adjusts to the target's position as it travels, making it very hard to dodge. Longest cooldown of any special move in the game as the tradeoff.
Poison
Physical – Venom Spur Kick (small melee hitbox, forward kick) Standard small melee hitbox. Poisons on hit — a longer-lasting but weaker-per-tick damage-over-time than Fire's burn. Special – Toxic Bloomcloud (stationary circular gas cloud that deploys at the user's current position and lingers) A circular hitbox that stays fixed at the location it was cast, not attached to the user. Poisons anything standing inside for its duration — smart enemies just walk around it.
Bug
Physical – Pincer Rush (two small consecutive melee hitboxes, same location, back to back) Two quick small hitboxes fired in immediate succession at the same spot — good close-range DPS, each hit alone is weak. Special – Swarmcall (small burst hitbox centered on the user, but its damage output scales with nearby Bug-type allies) A modest circular burst hitbox around the user. Damage increases if other Bug-type critters are on the user’s team — weakest special in the game with no allies present, strong with a full Bug squad.
Frost
Physical – Permafrost Fang (small melee bite hitbox) Standard small melee hitbox with a chance to freeze the target in place for 1 second. Freeze itself is the entire payoff — no bonus damage tacked on. Special – Blizzard Veil (circular hitbox centered on the user, purely defensive) A radius hitbox around the user that slows enemies caught inside and grants the user a brief speed boost. Deals zero damage — the only special move in the game that's pure utility.
Dragon
Physical – Ridgeback Slam (large frontal slam hitbox, melee) The single hardest-hitting hitbox in the game, positioned as a wide frontal slam. Longest cooldown of any physical move — big risk if you whiff the timing. Special – Draconic Surge (channeled beam hitbox that must be held to grow in width and range) Starts as a thin line hitbox and visibly widens/extends the longer it's held down. Interrupting the channel early (movement or taking a hit) fires a much weaker, shorter version.
