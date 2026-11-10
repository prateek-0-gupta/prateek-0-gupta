# Nagmani: design notes

A roguelite about a serpent whose body is the weapon. This file is the reasoning behind the code;
the numbers live in `game.js`, the words in `lore.js`, the map in `ward.js`.

## The one verb: the coil

Everything else in the game exists to set this up or to survive it going wrong.

- **Close a loop, crush what is inside.** The head's newest step is tested against the body's own
  path. Where they cross, the stretch of trail between is a polygon; every one of the dead standing
  in it takes the crush. Each extra one caught in the same coil adds +2, so herding pays.
- **The body is a wall.** The dead cannot walk through it (they path around it instead), so a
  half-closed coil is a cage and the body can be laid down as a barricade against a chaser.
- **The body is the purse.** Shards of the stone lengthen him (two to a segment). The Yaksha is
  paid in segments. Shedding costs segments. A longer serpent closes wider coils and catches more,
  but a longer serpent is also more surface for a hungry ghost to gnaw, and draws bigger waves.
- **The body cannot close what it cannot reach around.** Coil radius is capped at length / 2π. He
  starts at 24 segments (about a 100 px radius): enough for a knot of three, not for a guardian.

Supporting verbs, in order of how often they should be used:

| Verb | Input | What it is for |
|---|---|---|
| Fangs | click / F, in reach | Finishing the stunned, swatting thrown curses, punishing a hunter's recovery |
| Venom | click / F, out of reach | Homing bolt, 25 venom. Reaching casters; the only answer across water |
| Shed | right click / Space | 40 frames of speed nothing can touch; leaves a husk the dead will chase |
| Bells | touch | Stun everything in earshot. One or two per chamber, long recharge |

Steering follows the mouse (the natural way to draw a circle), or WASD, or a touch drag.

## A descent

Three wards and the bridge. About 8 minutes a ward.

1. **Wake** at a lit shrine. The ward is dealt from a seed: a self-avoiding walk across a 4×3
   lattice is the spine (wake → chambers → champion → guardian), with a shrine, a landmark and a
   Yaksha hung off it. The minimap shows a room once it has been seen from a neighbour, so the
   route is a choice.
2. **Chambers seal.** Walk in, the bells ring, brass bars drop. Waves arrive on telegraphed
   sigils. When the chamber is his again its diyas light (the ward visibly comes back as he
   clears it) and it gives up its **pieces of her**.
3. **Pieces break the seal.** Nine pieces a ward (the 27 nakshatras, in order). Five open the
   guardian's door; all nine are there for someone who clears everything.
4. **The guardian is brass.** Fangs and venom do 35% until he is **bound** in a coil; then the
   armour is off for five seconds and everything does 150%. Binding staggers him once; he keeps
   fighting while bound.
5. **Descend**, a quarter healed. After the third guardian, the Vaitarani bridge and Kalash.

He cannot die, so a fall ends the descent and he wakes in the Gardens with the streets moved.

## What is kept, what is lost

- **Lost on a fall:** boons, length, pieces, the ward's layout.
- **Kept forever:** the nine Memories. One landmark per ward holds the next unread one, so no
  single descent can hold them all (at least three descents for the true ending). Each Memory
  also changes him for good: more Prana, an extra boon to choose from, a longer start, cheaper
  Yaksha, a starting boon, faster bells, a harder crush, one refusal of death, and the last one
  opens the true crossing.
- **Endings:** Kalash down with fewer than 27 pieces (the far bank, and back to the Gardens);
  all 27 but Memories missing (she remembers, he does not); all of both (ascension).

## The dead

Each type asks a different question of the coil. Every one carries its own coloured light, so
the type reads in the dark before the silhouette does.

| | Behaviour | Answer |
|---|---|---|
| **Wraith** (blue) | Walks at the head, winds up a swipe at arm's length. Blocked by the body. | The lesson: lead them into a knot and close around it |
| **Hunter** (red) | Circles, backs off to make room, leaps at where the head *will* be. Two may leap at once; the rest wait their turn. Leaps over the body. | Sidestep the telegraphed line, bite it in recovery (double damage) |
| **Mantrik** (violet) | Keeps 250–470 px away, throws slow homing curses. | Curses die on a fang snap, a closed coil or the body; venom reaches him |
| **Drowned** (teal) | Lurks under its own puddle, lunges, then goes under and rises *ahead* of him. | Watch the ripple; it is helpless for 90 frames after a lunge |
| **Preta** (pale) | A hungry ghost: no armour, so the body does not stop it. Drifts to the nearest part of him and feeds. | Cannot be walled or caged for long: fangs, or a fast tight coil |
| **Sentinel** (amber) | Slow. Its front turns venom. Slams a telegraphed circle that also hits the body. | Get behind it, or coil it twice |

Shared brains: a flow field poured from the head every 10 frames for pathing, line-of-sight
before anything is thrown or leapt, going *around* the coil when blocked by it, separation so
they do not stack, and a preference for a fresh husk over a distant head.

Champions (one per ward) are the ward's signature type at 2.6× health.

## The guardians

A guardian fight has a shape: an entrance (its name across the screen), three phases that turn at
two thirds and one third of its health, and an ending.

- **Brass.** Fangs and venom do 35% until it is bound in a coil. A coil does triple crush to a
  guardian and opens it for five seconds, during which everything does double. The coil is the
  damage; the fangs finish what it opens.
- **A turn** (at 66% and 33%): it throws him clear without hurting him, cannot be hurt for a
  breath, drops a healing diya somewhere in the room, re-armours, and comes back with a wider kit
  and a faster tempo.
- **The end:** time halves, the brass comes apart in bursts for a few seconds, a white flash, and
  only then the pieces of her.
- Only a charge hurts on a graze. Otherwise he must be well inside its body to be hurt, so a coil
  can be drawn close.

Every attack is one of a few telegraphed shapes (`KIT` in `game.js`):

| Attack | Shape | Answer |
|---|---|---|
| charge / combo | A line, then a rush along it; combo is three in a row | Step off the line; it is open after the last one |
| slam | A circle on his head, one per phase | Keep moving |
| quake | Small circles marching along a line (three lines in the last phase) | Cross the line, not along it |
| pools | Thrown brass that lands, bursts and stays burning | Fight around them; they also burn the body |
| barrage | A scatter of small circles: bells (Mahant) or shards (Kalash) falling | Read the gaps |
| sweep | A beam turned through most of a circle | Stay ahead of it, or shed through it |
| blades | Thrown blades that go out and come back | They pass over the body; dodge twice |
| rings | Expanding rings with one gap | Go through the gap, or shed |
| orbs | A fan (a full ring in the last phase) of slow curses | A fang snap swats them |
| dive | Goes under, rises beneath him | Leave the ripple |
| summon | Two or three of the ward's dead | A reason to coil |

| Ward | Guardian | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| I | Senapati Vrika | charge, slam, summon | combo, blades, slam | combo, blades, quake |
| II | Loha | slam, quake, summon | quake, pools, rings, charge | pools, quake, rings, slam |
| III | The Mahant | dive, orbs, summon | dive, barrage, rings, orbs | barrage, dive, rings, orbs |
| IV | Maharaja Kalash | slam, charge, orbs | sweep, barrage, quake, rings | sweep, barrage, pools, rings, combo, orbs |

What hurts him is drawn in hot orange and red (`fx_shock`, `fx_fire`, `fx_pool`, `fx_claw`,
`fx_splash`, `fx_blade`, `fx_orb`); what he does is gold and green (`fx_coil`, the sigil, venom).

## Boons

Five aspects, so a choice of three is a choice between ways of fighting, not three numbers:
**Fang** (damage, lifesteal, executing the bound), **Venom** (burn, twin bolts, pierce, capacity),
**Coil** (crush, heal per crushed, stun ring, armoured body, greed), **Skin** (cheaper shed, a
husk that bursts, a refused death), **Prana** (health, bells, healing on clear, the map).

The Yaksha sells healing, a blind boon and extra Prana, for length.

## The look

- One camera, about 65° down, for every sprite. Walls show a carved south face with a lit ledge
  and throw a shadow on the paving; other wall edges show only a lip.
- **The dark is a light map**, a quarter-resolution canvas multiplied over the frame. Its floor is
  the ward's ambient colour. What lifts it: his own glow (wider as he lengthens), lit diyas and
  shrines, pickups, and every one of the dead. A cleared chamber stays lit, so progress is visible.
- Each ward has its own ambient, ground tint, flame colour and air: fireflies in the Gardens,
  embers in the Brass Quarter, mist over the Sanctum's tanks, violet motes over the river.
- The bridge is the same generator with the river where the walls would be.

## Files

| File | Holds |
|---|---|
| `snake.js` | The page: markup, styles, handlers |
| `game.js` | State, input, the coil, chambers, the dead, update, render |
| `ward.js` | The ward generator: lattice plan, rooms, passages, doorways |
| `lore.js` | Wards, Memories and their perks, nakshatras, voice lines, boons, endings, hints |
| `soundtrack.js` | Unchanged |
| `city.js` | The old fixed Manchester plan. No longer imported; kept in case it is wanted back |

## Debug

`/snake?debug` exposes `window.__nag`: `state()`, `rooms()`, `tp(roomId)`, `kill()`,
`boon(id)`, `set({ hp, len, god })`, `step(n)`. `?debug&ward=3` starts in a later ward.

## Not done yet

- Art still borrowed: the champion is its ward's ordinary sprite with a glow. A passage running east-west is
  shut by a different object from one running north-south (a spiked slab, `gate_slab`, not the
  barred gate, `bars_front`), because a flat gate seen edge-on is a sliver. Everything else added for the
  roguelite has its own sprite, generated by `tools/gen_snake_assets.mjs`; the game falls back to
  recolours if a file is missing.
- Music does not change with the ward or the fight.
- Balance has been run by a bot that only knows how to orbit; it needs hands.
