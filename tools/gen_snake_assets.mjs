#!/usr/bin/env node
// Generates Nagmani's art with Gemini image generation ("Nano Banana").
//
//   node tools/gen_snake_assets.mjs              # generate every asset that is missing
//   node tools/gen_snake_assets.mjs --force      # regenerate all of them
//   node tools/gen_snake_assets.mjs diya amrita  # only these
//   node tools/gen_snake_assets.mjs --set world  # only the v2 world set (floors, props, sheets)
//   node tools/gen_snake_assets.mjs --set interface  # frame, button plate, divider, icons, title backdrop (snake_assets/ui/)
//   node tools/gen_snake_assets.mjs --rekey      # redo transparency / tiling / sheet split from *.raw.png, no API calls
//
// Reads GEMINI_API_KEY from the environment or from .env at the repo root.
// Optional: GEMINI_IMAGE_MODEL (default gemini-2.5-flash-image), PREVIEW_DIR (writes
// copies composited over the game background for checking).
//
// Everything is post-processed with nothing but node's zlib so the repo keeps
// its no-node_modules rule:
//   - props, pickups, characters: requested on a flat magenta backdrop, chroma-keyed
//     to a transparent RGBA PNG
//   - floor tiles: requested as top-down textures, then made seamlessly tileable
//   - enemies: requested as a horizontal strip of walk-cycle frames, then split on
//     transparent gaps and re-laid into equal square cells (N cells wide, 1 high), so
//     the game can infer the frame count from width / height
// Existing sprites are passed in as style references.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'k/js/pages/projects/snake/snake_assets');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const REKEY = args.includes('--rekey');
const setArg = args.includes('--set') ? args[args.indexOf('--set') + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--set');

// ── key ──────────────────────────────────────────────────────────────
function loadEnv() {
    const p = join(ROOT, '.env');
    if (!existsSync(p)) return;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}
loadEnv();
const KEY = process.env.GEMINI_API_KEY;
if (!KEY && !REKEY) { console.error('GEMINI_API_KEY not set (env or .env)'); process.exit(1); }
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

// ── style ────────────────────────────────────────────────────────────
const LOOK = "Concept art for a video game with a unique INDIAN GOTHIC look, and that identity must come first: " +
    "the visual language of ruined Chola and Hoysala temple stone, Tantric and Naga iconography, cobra hoods, lotus and conch motifs, " +
    "rudraksha beads, bells, diyas, banyan roots strangling carved pillars, vermilion and ash, bone and blackened brass. " +
    "Two influences are folded in quietly, never dominating: the ornate techno-mythic filigree of Grant Morrison's '18 Days' " +
    "(Mukesh Singh's Mahabharata: baroque armour with fine glowing inlay, celestial machinery) and H. R. Giger's biomechanical anatomy " +
    "(ribbed exoskeleton, vertebrae and cable fused with flesh and stone). The result should not look like Giger or like generic sci-fi; " +
    "it should look like something dug out of a cursed South Indian temple. Rendering: highly detailed painterly digital art, " +
    "desaturated charcoal greys and near-blacks, aged tarnished brass and bronze, a little dull red or old gold glow where noted, " +
    "soft edges with wisps of smoke or incense. ";

const ISOLATE = "The subject is centred, fully inside the frame, not cropped, and isolated on a completely flat, solid, pure magenta (#FF00FF) background. " +
    "No ground shadow, no floor, no scenery, no text, no watermark, no border. Square image.";

// One camera for the whole world set, so every asset sits in the same space.
const CAM_PROP = "CAMERA: a fixed high-angle three-quarter top-down view, about 65 degrees above the ground looking down, " +
    "identical for every object in this set, so the top surface and the front face are both visible and the base is at the bottom of the object. " +
    "LIGHT: one cool key light from the upper left, warm bounce only where a flame is noted. Ignore the camera angle of any reference image. ";
const CAM_FLOOR = "CAMERA: perfectly top-down, straight down at 90 degrees, no perspective, even flat lighting, no vignette. " +
    "This is a SEAMLESS TILEABLE TEXTURE that fills the entire square image edge to edge: no border, no frame, no large object breaking the surface, " +
    "the pattern must be able to repeat. No text, no watermark. ";
const CAM_SHEET = "This is a SPRITE SHEET: exactly 4 frames of a walk cycle of the same character, arranged in ONE horizontal row, evenly spaced, " +
    "with a clear gap of empty magenta background between frames and nothing touching the image edges. Every frame has the same size, " +
    "the same camera (a fixed high-angle three-quarter top-down view, about 65 degrees above the ground) and the character FACING THE BOTTOM EDGE " +
    "of the image, walking toward the viewer, the frames differing only in the pose of the limbs. The four frames are spread evenly across " +
    "the full width of the image. There is NO panel, box, card, floor tile or dark rectangle behind any frame: the flat magenta backdrop shows " +
    "directly behind and between the characters. ";

// ── assets ───────────────────────────────────────────────────────────
// set: 'ui' (portraits etc, in snake_assets/) or 'world' (the coherent v2 set, in snake_assets/v2/)
// kind: 'prop' | 'floor' | 'sheet' | 'portrait'
const V2 = 'v2';
const ASSETS = {
    // ── UI / portraits (already generated earlier; kept) ──
    amrita:  { set: 'ui', kind: 'portrait', ref: 'enemy.png', prompt: 'Portrait bust of Amrita, a Naga queen of the underworld Patala: a serene young woman with deep brown skin and half-closed eyes, a crown of small cobra hoods fanning out behind her head like a ribbed biomechanical halo, antique gold filigree jewellery with faint glowing circuit lines, a lotus in her hair, faint gold light glowing from inside her, painted like a fading memory with the bottom of the bust dissolving into pale smoke.' },
    kalash:  { set: 'ui', kind: 'portrait', ref: 'enemy.png', prompt: 'Portrait bust of Maharaja Kalash, the Brass King: a gaunt old king whose body has become a tarnished brass machine, ornate corroded armour and a tall brass crown wired with cables into his skull, hollow black optic sockets, a cruel thin mouth, skin turned to bronze like a statue, hairline cracks of dull red light through the metal, smoke rising from the shoulders.' },
    naagraj: { set: 'ui', kind: 'portrait', ref: 'snake_head.png', prompt: 'Portrait bust of Naagraj, the Serpent King of Patala: a regal, mournful man with dark biomechanical scales creeping across one side of his face, a hood of seven cobra heads rising behind him like a ribbed exoskeletal crown, golden slit-pupil eyes, a broken gold crown, bare shoulders dissolving into dark smoke at the bottom.' },

    // ── WORLD SET: floor tiles (seamless, top-down) ──
    floor_stone:       { set: 'world', kind: 'floor', ref: 'floor-tile.png', prompt: 'Ancient temple floor of large cracked dark basalt flagstones with faint worn carvings of coiled serpents and lotus medallions, thin drifts of grey ash in the joints, a few hairline red-brown root veins. Dark, low contrast, no bright spots.' },
    floor_stone_roots: { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The SAME dark basalt flagstones as the reference tile, same stone size, same palette and brightness, with a few thin black banyan roots creeping along the joints and across two or three stones, and dead leaves in the cracks. A subtle variation, no large shapes.' },
    floor_stone_wet:   { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The SAME dark basalt flagstones as the reference tile, same stone size, same palette and brightness, with a thin film of still black water in the low parts of a few stones giving faint pale reflections, and a few drowned prayer beads. A subtle variation, no objects, no large shapes, no pipes.' },
    floor_stone_ash:   { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The SAME dark basalt flagstones as the reference tile, same stone size, same palette and brightness, with patches of pale grey ash drifted into the joints, a few small bone fragments and a faint smear of dull dried vermilion on one stone. Mostly grey, a subtle variation, no bright red areas.' },

    // ── WORLD SET: ground decals (keyed, top-down, laid on the floor) ──
    decal_puddle: { set: 'world', kind: 'prop', topdown: true, ref: 'floor-tile-puddle.png', prompt: 'A pool of still black water with an irregular organic edge, seen from directly above, faint concentric ripples and a dim pale reflection, a few drowned beads at the bottom. Flat on the ground.' },
    decal_rubble: { set: 'world', kind: 'prop', topdown: true, ref: 'fallen_statue.png', prompt: 'A scatter of broken carved temple stone, a cracked brass bell fragment, a snapped prayer-bead string and a few bones, seen from directly above, lying flat on the ground.' },
    decal_roots:  { set: 'world', kind: 'prop', topdown: true, ref: 'tree1.png', prompt: 'A tangle of thick black banyan roots and a few dead leaves seen from directly above, lying flat, an open organic shape with gaps through which the ground will show.' },

    // ── WORLD SET: the road and what lies on it ──
    floor_road:        { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The SAME dark basalt flagstones as the reference tile, same stone size, palette and brightness, but laid as a processional road: two shallow worn cart-grooves running straight across the tile from left to right, the stones between them polished smooth by centuries of feet, a thin line of brass inlay along each groove, ash in the joints. The grooves must run perfectly horizontal and meet the left and right edges at the same height so the tile repeats as a road.' },
    decal_road_broken: { set: 'world', kind: 'prop', topdown: true, ref: 'decal_rubble.png', prompt: 'A patch of collapsed temple road seen from directly above: dark basalt flagstones cracked and fallen inward into a shallow black pit, broken slabs tilted at the rim, a few brass inlay fragments and bones in the rubble. Irregular outline, flat on the ground.' },
    decal_snake_pile_a: { set: 'world', kind: 'prop', topdown: true, ref: 'statue_a.png', prompt: 'A heap of dead Naga citizens seen from directly above: serpent-bodied people, human torsos with cobra hoods, long scaled coils tangled together in a pile, skin gone grey and ashen, tarnished brass jewellery and torn cloth, dried near-black blood pooled under them. Grim, still, no gore detail, flat on the ground.' },
    decal_snake_pile_b: { set: 'world', kind: 'prop', topdown: true, ref: 'statue_a.png', prompt: 'Two dead Naga citizens seen from directly above, lying where they fell against each other: serpent coils gone grey and ashen, one hooded head turned to the sky, a broken clay diya and prayer beads beside them, dried near-black blood beneath. Grim, still, flat on the ground.' },
    decal_blood_a:     { set: 'world', kind: 'prop', topdown: true, ref: 'decal_puddle.png', prompt: 'A large pool of long-dried blood on dark temple stone seen from directly above: near-black crimson, matte, cracked at the edges like old paint, with a smeared drag mark trailing off one side. Irregular organic outline, flat on the ground.' },
    decal_blood_b:     { set: 'world', kind: 'prop', topdown: true, ref: 'decal_puddle.png', prompt: 'Dried blood splatter on dark temple stone seen from directly above: a dense near-black crimson centre with spattered droplets flung outward in one direction and a few serpentine drag trails. Matte, old, flat on the ground.' },
    fx_smoke:          { set: 'world', kind: 'prop', ref: 'enemy.png', prompt: 'A single soft puff of pale grey ash-smoke, wispy and translucent at the edges, roughly round, no hard outline, lit faintly from above. Nothing else in the image.' },

    // ── WORLD SET: the maze city: rubble fields between the streets, the river, the gate, the war ──
    floor_ruin:   { set: 'world', kind: 'floor', ref: 'decal_rubble.png', prompt: 'A dense, even TEXTURE of burnt city rubble covering the ENTIRE image edge to edge, seen straight down: heaped broken dark stone, fragments of carved lintels, charred black beams, ash drifts, bone splinters, bits of blackened brass. NO flagstones, NO tiles, NO grid, NO carvings of snakes: this is debris, not paving. Very dark, low contrast, uniform density across the whole image, no single large object, no empty areas, no white, repeatable.' },
    floor_water:  { set: 'world', kind: 'floor', ref: 'decal_puddle.png', prompt: 'A TEXTURE of slow, nearly black river water covering the entire image edge to edge, seen straight down: faint oily ripples, a few drifting dead leaves and flecks of ash, very low contrast, deep near-black green-grey. Water only: no stone, no tiles, no carvings, no banks, no objects. Repeatable.' },
    gate:         { set: 'world', kind: 'prop', ref: 'shrine_a.png', prompt: 'A great ruined gateway at the head of a stone bridge: two tall carved pillars crowned by spread cobra hoods, a broken lintel between them hung with a row of silent brass bells, chains, banyan roots, the stone scorched by war. Seen from the shared high camera, front-on. Large.' },
    decal_war_a:  { set: 'world', kind: 'prop', topdown: true, ref: 'decal_rubble.png', prompt: 'Seen from directly above, lying flat: the wreck of a brass war chariot or siege engine from an ancient Indian army reimagined as biomechanical machinery, overturned, one wheel off, cables and vertebrae spilling out, scorched, ash around it. Flat on the ground.' },
    decal_war_b:  { set: 'world', kind: 'prop', topdown: true, ref: 'decal_rubble.png', prompt: 'Seen from directly above, lying flat: scattered arms after a battle: broken brass spears, a cracked round shield with a cobra emblem, a fallen banner of faded red cloth, arrows, a helmet with a cobra crest, dried near-black blood between them. Flat on the ground.' },

    // ── WORLD SET: attack effects (keyed, drawn flat and spun/scaled by the game) ──
    fx_venom_bolt: { set: 'world', kind: 'prop', topdown: true, ref: 'pickup_soul.png', prompt: 'A single bolt of glowing venom seen from directly above, flying to the RIGHT: a bright acid-green and pale gold core with a long tapering comet tail trailing to the LEFT edge, wisps and droplets of green light, a faint gold filigree spark at the head. Luminous, no background objects.' },
    fx_venom_burst: { set: 'world', kind: 'prop', topdown: true, ref: 'pickup_soul.png', prompt: 'A radial splash of glowing acid-green venom seen from directly above: droplets and thin tendrils flung outward from a bright centre, a few pale gold sparks among them, luminous, round composition, nothing else.' },
    fx_blood_burst: { set: 'world', kind: 'prop', topdown: true, ref: 'decal_blood_b.png', prompt: 'A burst of an Asura being unmade, seen from directly above: a radial spray of near-black blood, grey ash flakes and small fragments of blackened brass armour flung outward from the centre, a few dull red embers, round composition, nothing else.' },
    fx_sigil: { set: 'world', kind: 'prop', topdown: true, ref: 'pickup_lotus.png', prompt: 'A circular Tantric sigil of pale gold light seen flat from directly above: concentric rings of fine glowing filigree, a ring of small lotus petals, Sanskrit-like glyph marks around the outer ring, a cobra-hood motif at the top, thin luminous lines on nothing. Perfectly round, centred.' },
    fx_slash: { set: 'world', kind: 'prop', topdown: true, ref: 'pickup_lotus.png', prompt: 'A single crescent-shaped slash of pale gold light with two fang points, seen from directly above, the crescent opening to the LEFT and its sharp tips pointing RIGHT, sharp and luminous with faint motes along its edge, nothing else.' },

    // ── WORLD SET: props (keyed, shared 65-degree camera) ──
    shrine_a:      { set: 'world', kind: 'prop', ref: 'shrine.png', prompt: 'A small ruined stone shrine: a square carved base, a cracked canopy shaped like a spread cobra hood sheltering a dark empty niche, a brass bell hanging on a chain, banyan roots gripping one side, an unlit clay diya on the step. About two storeys of a person tall.' },
    shrine_b:      { set: 'world', kind: 'prop', ref: 'shrine_2.png', prompt: 'A ruined shrine built as a stepped lotus pedestal of dark stone, on it a broken idol of a seven-hooded Naga king missing its head, rudraksha garlands turned to dust, roots through the steps, an unlit clay diya at the front.' },
    pillar:        { set: 'world', kind: 'prop', ref: 'pillar.png', prompt: 'A single standing temple pillar of dark stone on a square base, carved with coiled serpents climbing it and a lotus capital, the top broken off unevenly, roots on the base. Tall and narrow.' },
    pillar_broken: { set: 'world', kind: 'prop', ref: 'pillar.png', prompt: 'The stump of a broken temple pillar of dark stone, knee high, carved serpent coils still visible, the broken top jagged, rubble and ash around the base.' },
    bell_fallen:   { set: 'world', kind: 'prop', ref: 'bell.png', prompt: 'A large cracked temple bell of blackened brass lying on its side on the ground, its chain snapped and coiled beside it, Sanskrit letters around its rim, a dull gold gleam inside the crack.' },
    tree_a:        { set: 'world', kind: 'prop', ref: 'tree1.png', prompt: 'A dead banyan tree seen from the shared high camera: a gnarled black trunk, a wide tangled canopy of bare branches and hanging aerial roots, a few pale luminous leaves like ghost lights caught in it. Mostly canopy visible from above.' },
    tree_b:        { set: 'world', kind: 'prop', ref: 'tree2.png', prompt: 'A dead banyan tree seen from the shared high camera, leaning, its aerial roots fused into a strangling cage around a broken stone idol inside the trunk, bare branches, ash on the roots.' },
    tree_c:        { set: 'world', kind: 'prop', ref: 'tree3.png', prompt: 'A dead sacred fig tree seen from the shared high camera, thin and tall, strips of faded red prayer cloth tied to the lower branches, brass bells hanging from them, bare canopy.' },
    statue_a:      { set: 'world', kind: 'prop', ref: 'fallen_statue.png', prompt: 'A colossal fallen stone statue of a Naga king lying broken across the ground, the hooded head snapped from the torso, moss and ash in the carvings, seen from the shared high camera.' },
    statue_b:      { set: 'world', kind: 'prop', ref: 'fallen_statue_1.png', prompt: 'The toppled upper half of a colossal many-armed stone guardian statue, face down, two of its arms snapped off and lying beside it, brass inlay in the broken edges, seen from the shared high camera.' },
    diya:          { set: 'world', kind: 'prop', ref: 'shrine.png', prompt: 'A small lit clay diya oil lamp with a tarnished brass rim and a tiny cobra-hood finial, one small steady flame with a warm golden halo, seen from the shared high camera. Small prop.' },

    // ── WORLD SET: pickups ──
    pickup_shard: { set: 'world', kind: 'prop', ref: 'food.png',       prompt: 'A jagged shard of a broken golden gemstone, the Nagmani, glowing warmly from within, lying tilted on the ground, a few golden motes rising from it. Small pickup item.' },
    pickup_soul:  { set: 'world', kind: 'prop', ref: 'soul_shard.png', prompt: 'A small wisp of violet soul-light coiled around a single glowing vertebra of pale bone, hovering just above the ground. Small pickup item.' },
    pickup_lotus: { set: 'world', kind: 'prop', ref: 'memory_lotus.png', prompt: 'A lotus flower whose petals are thin plates of pale gold metal and light, open, a single floating shard of white-gold crystal at its centre, fine filigree glowing along the petals, soft warm glow. Small pickup item seen from the shared high camera.' },

    // ── WORLD SET: the snake (top-down, pointing right, so the game can rotate it) ──
    snake_head: { set: 'world', kind: 'prop', topdown: true, ref: 'snake_body.png', prompt: 'AERIAL VIEW, looking straight down at the TOP of the head of a huge black cobra as it crawls to the RIGHT: the snout is at the right edge of the image, the neck enters from the left, the spread hood fans out above and below the head (toward the top and bottom edges of the image). We see the back of the head and the top of the hood only, with its gold filigree eye-spots, dark biomechanical scales and a cracked golden gem set in the crown, dull red glow in the cracks. The face, mouth and belly are NOT visible. Horizontal composition, no front view.' },
    snake_body: { set: 'world', kind: 'prop', topdown: true, ref: 'snake_body.png', prompt: 'One short straight segment of a huge black cobra\'s body seen from directly above, horizontal, left to right, dark biomechanical scales with a thin gold filigree stripe down the spine, the ends cut cleanly so segments can be chained.' },
    snake_tail: { set: 'world', kind: 'prop', topdown: true, ref: 'snake_tail.png', prompt: 'The tapering tail tip of a huge black cobra seen from directly above, horizontal, thick at the LEFT and tapering to a fine point at the RIGHT edge, dark biomechanical scales with a thin gold stripe.' },

    // ── INTERFACE SET: frame, plate, divider, icons, backdrop (snake_assets/ui/) ──
    ui_frame:      { set: 'interface', max: 640, kind: 'ui', ref: 'shrine_a.png', prompt: 'An ornamental square FRAME for a game interface, symmetrical, flat and front-on with no perspective: a border of carved dark temple stone edged with blackened brass, about one fifth of the image wide on every side, a coiled cobra-hood ornament at each of the four corners, and along each straight side a repeating rail of small lotus and rudraksha-bead carving. The CENTRE of the image is completely EMPTY, the same flat pure magenta as outside the frame.' },
    ui_button:     { set: 'interface', kind: 'backdrop', wide: true, max: 768, ref: 'bell_fallen.png', prompt: 'A wide ornate PLATE for a game menu button, filling the ENTIRE image edge to edge with no background visible: beaten, polished brass with a raised border of lotus-and-rudraksha-bead moulding along the top and bottom edges, a spread cobra-hood finial at each end occupying roughly the outer fifth of the width, and a plain, smooth, softly worn centre with NO decoration, text or symbol. Flat, front-on, evenly lit, slightly brighter at the middle.' },
    ui_button_iron: { set: 'interface', kind: 'backdrop', wide: true, max: 768, ref: 'bell_fallen.png', prompt: 'A wide ornate PLATE for a game menu button, filling the ENTIRE image edge to edge with no background visible: blackened iron with a thin brass border of lotus-and-bead moulding along the top and bottom edges, a small tarnished-brass cobra-hood finial at each end occupying roughly the outer fifth of the width, and a plain, smooth, dark centre with NO decoration, text or symbol. Flat, front-on, evenly and dimly lit.' },
    ui_divider:    { set: 'interface', max: 640, kind: 'ui', wide: true, ref: 'bell_fallen.png', prompt: 'A thin horizontal ornamental DIVIDER for a game interface, flat and front-on: a brass line that tapers to fine points at both ends and thickens at the centre into a small spread cobra hood holding a lotus medallion, with a few rudraksha beads strung along the line.' },
    ui_backdrop:   { set: 'interface', max: 1400, kind: 'backdrop', wide: true, ref: 'shrine_a.png', prompt: 'A wide, very dark painting of the drowned temple city of Patala seen from a high vantage: a colonnaded processional avenue vanishing into black fog, great broken Naga statues, dead banyan trees with hanging roots, shallow black water on the paving reflecting a few dull gold points of distant diya flames. Almost black overall, low contrast, moody, with no text, no characters, no bright areas. Fills the whole image.' },
    ui_icon_shard: { set: 'interface', max: 160, kind: 'ui', ref: 'pickup_shard.png', prompt: 'A single bold game interface ICON, centred and filling most of the frame, flat front-on, readable at a small size: a jagged shard of golden gemstone glowing from within.' },
    ui_icon_soul:  { set: 'interface', max: 160, kind: 'ui', ref: 'pickup_soul.png', prompt: 'A single bold game interface ICON, centred and filling most of the frame, flat front-on, readable at a small size: a wisp of violet soul-flame coiled around a pale bone vertebra.' },
    ui_icon_lotus: { set: 'interface', max: 160, kind: 'ui', ref: 'pickup_lotus.png', prompt: 'A single bold game interface ICON, centred and filling most of the frame, flat front-on, readable at a small size: an open lotus of pale gold metal with a small white crystal at its centre.' },
    ui_icon_flame: { set: 'interface', max: 160, kind: 'ui', ref: 'diya.png', prompt: 'A single bold game interface ICON, centred and filling most of the frame, flat front-on, readable at a small size: a small clay diya lamp with a single warm golden flame.' },
    ui_icon_shed:  { set: 'interface', max: 160, kind: 'ui', ref: 'snake_body.png', prompt: 'A single bold game interface ICON, centred and filling most of the frame, flat front-on, readable at a small size: a translucent shed snake skin coiled in a loose ring, pale and papery, with a dark cobra scale pattern.' },

    // ── WORLD SET: enemy walk cycles (4-frame horizontal sheets, facing down) ──
    wraith_walk:   { set: 'world', kind: 'sheet', frames: 4, ref: 'enemy.png', prompt: 'An Asura wraith: a soldier of the Brass King reduced to a column of dark grey smoke (charcoal grey, NOT pure black, so its shape reads against a dark floor) wearing cracked tarnished brass shoulder armour and a brass breastplate, two burning red eyes, long smoky clawed arms. It drifts and lurches rather than walks: frames show the smoke body swaying and the arms swinging. The backdrop must be pure magenta, nothing else.' },
    hunter_walk:   { set: 'world', kind: 'sheet', frames: 4, ref: 'enemy_hunter.png', prompt: 'A Brass Hunter: a lean hunched soldier of black smoke, exposed vertebrae and brass cabling, cracked brass armour etched with Sanskrit circuitry, a brass hound-skull helm with red optic slits, long clawed arms of bone and pistons. A sprinting run cycle on all fours, low to the ground.' },
    drowned_walk:  { set: 'world', kind: 'sheet', frames: 4, ref: 'enemy_drowned.png', prompt: 'A Drowned One: the bloated grey-green ghost of a temple priest, wet hair over the face, barnacle-like chitin and corroded tubing grown into the skin, prayer beads fused into a cable at the neck, pale glowing cyan eyes, dripping. A slow wading crawl, arms reaching forward.' },
    sentinel_walk: { set: 'world', kind: 'sheet', frames: 4, ref: 'enemy_sentinel.png', prompt: 'A Brass Sentinel: a massive headless colossus of corroded brass and black iron in the style of a South Indian temple guardian, ribbed biomechanical torso, hydraulic cables for tendons, a huge spiked mace grown from one forearm, a hollow chest cavity glowing with dull red embers. A heavy slow stomping walk.' },

    // ── the roguelite (2026-11-10): the two dead that were recolours, the four guardians, the Yaksha, the way down, a ground per ward ──
    preta_walk:    { set: 'world', kind: 'sheet', frames: 4, ref: 'wraith_walk.png', prompt: 'A Preta, the hungry ghost of Indian tradition: an emaciated naked spirit with a hugely distended belly, a neck as thin as a needle, a tiny pinched mouth that cannot be filled, long spindly arms and clawed fingers, sunken glowing pale-teal eyes, skin a pale translucent grey-teal (pale enough to read against a dark floor) dissolving into mist at the feet, a broken begging bowl in one hand. It drifts forward reaching; frames show the arms groping and the body swaying.' },
    mantrik_walk:  { set: 'world', kind: 'sheet', frames: 4, ref: 'drowned_walk.png', prompt: 'A Mantrik, a tantric chanter in the service of the Brass King: a gaunt ash-smeared sorcerer in a ragged dark-violet hooded shawl, ropes of rudraksha beads, a skull bowl in one hand and a small flame of violet light cupped in the other raised palm, three ash lines across the brow, eyes glowing dull violet, bare feet hovering just off the ground, strips of cloth trailing. A slow gliding walk; frames show the shawl and the raised hand shifting.' },
    vrika_walk:    { set: 'world', kind: 'sheet', frames: 4, ref: 'hunter_walk.png', prompt: 'Senapati Vrika, hound-master general of the Brass King, a BOSS: a towering broad warrior in cracked blackened-brass lamellar armour, a helm cast as a snarling wolf skull with red optic slits, a cloak of grey wolf pelts, a heavy curved khanda sword in one hand and a fistful of broken iron leash-chains trailing from the other, vertebrae and brass cabling showing at the joints, dull red glow in the chest. A heavy prowling stride; frames show the legs and the chains swinging. He is SOLID and opaque, a man of metal and bone, NOT smoke and NOT translucent: mid-grey steel and warm brass tones that read clearly against a dark floor, lit from the upper left.' },
    loha_walk:     { set: 'world', kind: 'sheet', frames: 4, ref: 'sentinel_walk.png', prompt: 'Loha, Warden of the Forge, a BOSS: a massive hunched smith-colossus of soot-black iron and brass, its chest an open furnace door glowing orange, a great crucible of molten brass strapped to its back dripping bright metal, one arm ending in a huge forge hammer, the other in long tongs, a blank riveted faceplate with a single slit, bellows-ribbed torso, smoke rising. A slow crushing walk; frames show the hammer arm and legs moving. It is the SAME identical character in all four frames, seen from the same front view: the crucible always on its back, the hammer always on the same arm, the tongs always on the other; only the stride changes.' },
    mahant_walk:   { set: 'world', kind: 'sheet', frames: 4, ref: 'drowned_walk.png', prompt: 'The Mahant, the drowned high priest who sold the temple bells, a BOSS: a very tall bloated figure in waterlogged saffron-gold ceremonial robes gone dark, a tall crown hung with small corroded bells, long wet white beard, barnacles and brass tubing grown into grey-green skin, glowing pale cyan eyes, carrying a great cracked temple bell on a long staff like a mace, prayer beads fused into cable at the neck, water streaming from the sleeves. A slow wading walk; frames show the robes and the bell-staff swaying.' },
    kalash_walk:   { set: 'world', kind: 'sheet', frames: 4, ref: 'sentinel_walk.png', prompt: 'Maharaja Kalash, the Brass King, the FINAL BOSS: a gaunt, very tall old king whose whole body has become tarnished gold-brass, in ornate baroque royal armour with fine glowing filigree, a tall tiered crown wired into his skull, hollow black eye sockets with pin-points of red, hairline cracks of dull red light through the metal, a long royal mace with a lotus-bud head in one hand, a cape made of fine brass chain, his legs heavy pistoned brass. A slow regal advance; frames show the legs, cape and mace arm moving.' },
    yaksha:        { set: 'world', kind: 'prop', ref: 'shrine_b.png', prompt: 'A Yaksha treasure-keeper at his stall: a squat, pot-bellied, broad-faced nature spirit in the style of ancient Indian Kubera sculpture, seated cross-legged on a low carved stone plinth, heavy gold earrings and a jewelled turban, a sly patient smile, holding up a brass balance scale, around him small heaps of coins, gems and golden shards, a mongoose at his knee, one lit clay diya. Warm old-gold light on him. About the height of a shrine.' },
    stairwell:     { set: 'world', kind: 'prop', topdown: true, ref: 'decal_road_broken.png', prompt: 'A round stone stairwell descending into darkness, seen from directly above: a ring of carved dark basalt with a cobra-hood rim, a spiral of worn steps winding down into pure black at the centre, a faint cold violet glow rising from below, brass inlay on the rim. Perfectly round, flat on the ground.' },
    floor_gardens: { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The paving of a ruined temple garden: large dark basalt flagstones of the same size as the reference tile, with moss and thin grass in the joints, worn lotus-medallion carvings on a few stones, scattered dead leaves and a few pale fallen petals. Dark, low contrast, a faint green cast, no bright spots, no large objects.' },
    floor_brass:   { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The floor of a ruined foundry quarter: large dark basalt flagstones of the same size as the reference tile, edged with thin strips of tarnished brass inlay, a few round brass rivets, soot staining, and two or three small cooled splashes of dull spilled brass. Dark, low contrast, a faint warm cast, no bright spots, no large objects.' },
    floor_sanctum: { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The floor of a flooded temple sanctum: large dark slate-grey flagstones of the same size as the reference tile, carved with shallow worn wave and conch-shell motifs, a thin film of still water lying in the low places with faint pale reflections, hairline cracks. Dark, low contrast, a faint cold blue-green cast, no bright spots, no objects.' },
    floor_bridge:  { set: 'world', kind: 'floor', ref: 'floor_stone.png', prompt: 'The deck of an ancient stone bridge over the river of the dead: long worn slabs of dark grey-violet stone of the same scale as the reference tile, shallow carvings of small boats and reaching hands almost worn away, ash and a few bone splinters in the joints, hairline cracks. Dark, low contrast, a faint violet cast, no bright spots, no objects.' },
    wall_frieze:   { set: 'world', kind: 'floor', ref: 'pillar.png', prompt: 'A carved temple WALL FACE seen flat and front-on as a repeating texture: dark basalt blocks in even horizontal courses, the middle course a continuous frieze of small coiled serpents and lotus rosettes in low relief, a plain moulded band along the top and bottom, hairline cracks, soot. Evenly lit, dark, low contrast, the courses running perfectly horizontal so the tile repeats sideways.' },

    // ── what the dead and the guardians do to him: hot orange and red, so it never reads as his own gold and green ──
    fx_shock:  { set: 'world', kind: 'prop', topdown: true, ref: 'fx_venom_burst.png', prompt: 'A circular shockwave seen from directly above: one thin, bright ring of hot orange-gold light with a ragged outer edge of flying dust, stone chips and sparks, and a completely EMPTY centre (the ring is hollow, the backdrop colour shows through the middle). Perfectly round, centred, luminous, nothing else.' },
    fx_fire:   { set: 'world', kind: 'prop', topdown: true, ref: 'fx_venom_burst.png', prompt: 'An eruption of molten brass and fire seen from directly above: a bright white-gold core, radial tongues of orange flame and flung droplets of glowing liquid metal, a few black smoke wisps at the rim. Round composition, centred, luminous, nothing else.' },
    fx_pool:   { set: 'world', kind: 'prop', topdown: true, ref: 'decal_puddle.png', prompt: 'A pool of molten brass burning on the ground, seen from directly above: an irregular round puddle of glowing orange-gold liquid metal with a darker cooling crust at its edge, small flames licking up around the rim, bright bubbles. Flat on the ground, luminous, nothing else.' },
    fx_orb:    { set: 'world', kind: 'prop', topdown: true, ref: 'pickup_soul.png', prompt: 'A cursed orb seen from directly above: a ball of deep violet-blue flame with a small pale skull-like glyph at its core and a ring of tiny Sanskrit-like marks orbiting it, short wisps trailing off it. Use violet and indigo, never pink. Round, centred, luminous, nothing else.' },
    fx_claw:   { set: 'world', kind: 'prop', topdown: true, ref: 'fx_slash.png', prompt: 'Three parallel curved claw slashes of hot red-orange light, like one raking strike, seen from directly above: three crescents side by side opening to the LEFT with their sharp tips pointing RIGHT, a few red sparks flying off. Luminous, nothing else.' },
    fx_splash: { set: 'world', kind: 'prop', topdown: true, ref: 'decal_puddle.png', prompt: 'A splash of black water seen from directly above: a ring-shaped crown of flung water with pale cyan glowing foam and droplets thrown outward, dark in the middle. Round, centred, luminous cyan highlights, nothing else.' },
    fx_blade:  { set: 'world', kind: 'prop', topdown: true, ref: 'bars_front.png', prompt: 'A thrown khanda sword blade spinning like a boomerang, seen from directly above: one broad curved blackened-brass blade with a red-hot glowing edge, wrapped in circular motion-blur streaks of red light that show the spin. Round composition, centred, nothing else.' },
    fx_coil:   { set: 'world', kind: 'prop', topdown: true, ref: 'fx_sigil.png', prompt: 'An ouroboros seen from directly above: a serpent made of pale gold light forming one perfect ring and biting its own tail, fine glowing scales along it, the centre of the ring EMPTY (the backdrop colour shows through), a faint halo of gold motes around it. Perfectly round, centred, luminous, nothing else.' },
    gate_slab:     { set: 'world', kind: 'prop', ref: 'bars_front.png', prompt: 'A massive sliding GATE-SLAB that seals a temple passage, in the same blackened brass and dark stone as the gate in the reference. It is one long solid block shaped like a long sarcophagus or a thick wall segment: about one unit wide, five units long and one unit tall, and it points straight AWAY from the viewer, so in the image it is a tall narrow shape running from the bottom centre to the top centre. From the high camera we see two faces only: (1) its long flat TOP, which fills most of the height of the image: dark stone bound in brass straps, a raised brass serpent spine running down the middle from end to end, a row of small upright cobra-hood spikes along both long edges, and a round lotus seal in the middle; (2) its near END face at the bottom: a square brass panel with a cobra-hood emblem and a heavy ring. Both long edges are perfectly straight and parallel and vertical in the image; the slab has the same width at the top as at the bottom (no perspective narrowing). Dull gold gleam on the brass. Only the slab: no wall, no floor, no posts beside it.' },
    bars_front:    { set: 'world', kind: 'prop', wide: true, max: 640, ref: 'gate.png', prompt: 'A wide BARRIER GATE of blackened brass that seals a temple passage, seen front-on from the shared high camera: one single straight row of thick vertical bars, each bar topped with a small spread cobra-hood finial, joined by two horizontal rails, a round lotus-and-serpent seal boss in the middle, and a heavy square post with a small bell cap at the far left end and at the far right end. It runs perfectly straight and level from the left edge of the subject to the right, symmetrical, about twice the height of a person, a dull gold gleam on the brass. Only the gate: no wall, no floor, no arch.' },
};

function outDir(spec) { return spec.set === 'world' ? join(OUT, V2) : spec.set === 'interface' ? join(OUT, 'ui') : OUT; }
function refPath(spec) {
    if (!spec.ref) return null;
    for (const dir of [OUT, join(OUT, V2), join(OUT, 'ui')]) { const p = join(dir, spec.ref); if (existsSync(p)) return p; }
    return null;
}

function promptFor(spec) {
    if (spec.kind === 'floor') return LOOK + CAM_FLOOR + '\n\nTexture: ' + spec.prompt;
    if (spec.kind === 'sheet') return LOOK + CAM_SHEET + ISOLATE.replace('The subject is centred, fully inside the frame, not cropped, and', 'All four frames are fully inside the frame and') + '\n\nCharacter: ' + spec.prompt;
    if (spec.kind === 'portrait') return LOOK + ISOLATE + '\n\nSubject: ' + spec.prompt;
    if (spec.kind === 'backdrop') return LOOK + 'CAMERA: a wide painted vista, no interface, no border, filling the whole image edge to edge. No text, no watermark. ' + '\n\nScene: ' + spec.prompt;
    if (spec.kind === 'ui') return LOOK + 'This is a piece of GAME INTERFACE ART, flat and front-on, crisp edges, symmetrical where the subject allows. ' + ISOLATE.replace('Square image.', spec.wide ? 'Wide image.' : 'Square image.') + '\n\nSubject: ' + spec.prompt;
    const cam = spec.topdown ? 'CAMERA: seen from directly above, straight down, no perspective. ' : CAM_PROP;
    return LOOK + cam + ISOLATE + '\n\nSubject: ' + spec.prompt;
}

// ── gemini call ──────────────────────────────────────────────────────
async function generate(name, spec) {
    const parts = [];
    const ref = refPath(spec);
    if (ref) {
        parts.push({ inlineData: { mimeType: 'image/png', data: readFileSync(ref).toString('base64') } });
        parts.push({ text: 'Use this image only as a reference for rendering style, palette and level of detail. Do not copy its subject, framing or camera angle.' });
    }
    parts.push({ text: promptFor(spec) });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: spec.kind === 'sheet' || spec.wide ? '21:9' : '1:1' } },
    };
    for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const txt = await res.text();
            if (res.status === 400 && /aspect/i.test(txt) && body.generationConfig.imageConfig.aspectRatio !== '1:1') {
                body.generationConfig.imageConfig.aspectRatio = '1:1'; // older models only know a few ratios
                continue;
            }
            if (res.status === 429 || res.status >= 500) {
                console.warn(`  ${name}: HTTP ${res.status}, retrying in ${attempt * 15}s`);
                await new Promise(r => setTimeout(r, attempt * 15000));
                continue;
            }
            throw new Error(`HTTP ${res.status}: ${txt.slice(0, 400)}`);
        }
        const json = await res.json();
        const img = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!img) {
            const txt = json.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ') || JSON.stringify(json).slice(0, 300);
            console.warn(`  ${name}: no image in response (${txt.slice(0, 200)}), retrying`);
            continue;
        }
        return { mime: img.inlineData.mimeType, buf: Buffer.from(img.inlineData.data, 'base64') };
    }
    throw new Error('gave up after 3 attempts');
}

// ── minimal PNG codec (8-bit, non-interlaced) ────────────────────────
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c;
});
function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function decodePNG(buf) {
    if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
    let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
    const idat = [];
    let palette = null, trns = null;
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('latin1', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            w = data.readUInt32BE(0); h = data.readUInt32BE(4);
            depth = data[8]; ctype = data[9]; interlace = data[12];
        } else if (type === 'PLTE') palette = data;
        else if (type === 'tRNS') trns = data;
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * channels;
    const px = Buffer.alloc(stride * h);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const cur = px.subarray(y * stride, (y + 1) * stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? cur[i - channels] : 0;
            const b = prev[i];
            const c = i >= channels ? prev[i - channels] : 0;
            let v = line[i];
            if (f === 1) v += a;
            else if (f === 2) v += b;
            else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            cur[i] = v & 0xff;
        }
        prev = cur;
    }
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        let r, g, b, a = 255;
        if (ctype === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
        else if (ctype === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3]; }
        else if (ctype === 0) { r = g = b = px[i]; }
        else if (ctype === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
        else { const k = px[i]; r = palette[k * 3]; g = palette[k * 3 + 1]; b = palette[k * 3 + 2]; a = trns && k < trns.length ? trns[k] : 255; }
        rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
    }
    return { w, h, rgba };
}

function encodePNG(w, h, rgba) {
    const stride = w * 4;
    const raw = Buffer.alloc((stride + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (stride + 1)] = 0;
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
        return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── chroma key against the dominant border colour ────────────────────
function chromaKey({ w, h, rgba }) {
    const rs = [], gs = [], bs = [];
    const take = (x, y) => { const i = (y * w + x) * 4; rs.push(rgba[i]); gs.push(rgba[i + 1]); bs.push(rgba[i + 2]); };
    for (let x = 0; x < w; x++) { take(x, 0); take(x, 1); take(x, h - 1); take(x, h - 2); }
    for (let y = 0; y < h; y++) { take(0, y); take(1, y); take(w - 1, y); take(w - 2, y); }
    const med = arr => arr.sort((a, b) => a - b)[arr.length >> 1];
    const kr = med(rs), kg = med(gs), kb = med(bs);
    if (!(kr > 150 && kb > 150 && kg < 120)) console.warn(`  backdrop is rgb(${kr},${kg},${kb}), not magenta; keying anyway`);

    const SOFT0 = 40, SOFT1 = 120;
    for (let i = 0; i < w * h; i++) {
        const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
        const d = Math.hypot(r - kr, g - kg, b - kb);
        const a = Math.min(1, Math.max(0, (d - SOFT0) / (SOFT1 - SOFT0)));
        if (a <= 0) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = rgba[i * 4 + 3] = 0; continue; }
        // a magenta cast is red and blue both above green; warm golds (blue below green) and true reds
        // (blue low) are untouched. Cast pixels are the model's backdrop bleeding into smoke and haze,
        // so they are pulled down to near-black ash rather than merely neutralised.
        const cast = Math.max(0, Math.min(r, b) - g);
        if (cast > 0) {
            const k = Math.min(1, cast / 60) * 0.85;
            let r2 = r - (r - g) * k, b2 = b - (b - g) * k, g2 = g;
            const pink = Math.min(1, cast / 50);
            const lum = 0.3 * r2 + 0.59 * g2 + 0.11 * b2;
            const grey = 0.6 * pink; // desaturate toward luminance
            r2 += (lum - r2) * grey; g2 += (lum - g2) * grey; b2 += (lum - b2) * grey;
            const dark = 1 - 0.78 * pink; // and darken
            rgba[i * 4]     = Math.round(r2 * dark);
            rgba[i * 4 + 1] = Math.round(g2 * dark);
            rgba[i * 4 + 2] = Math.round(b2 * dark);
        }
        if (a < 1) {
            const r2 = rgba[i * 4], g2 = rgba[i * 4 + 1], b2 = rgba[i * 4 + 2];
            const lum = 0.3 * r2 + 0.59 * g2 + 0.11 * b2;
            const dsat = 0.35 + 0.5 * (1 - a);
            rgba[i * 4]     = Math.round(r2 + (lum - r2) * dsat);
            rgba[i * 4 + 1] = Math.round(g2 + (lum - g2) * dsat);
            rgba[i * 4 + 2] = Math.round(b2 + (lum - b2) * dsat);
            rgba[i * 4 + 3] = Math.round(a * a * 255);
        }
    }
    return { w, h, rgba };
}

// ── seamless tiling: shift by half, heal the exposed seam with the original ──
function makeSeamless({ w, h, rgba }) {
    const out = Buffer.alloc(rgba.length);
    const mx = Math.floor(w / 8), my = Math.floor(h / 8);
    const smooth = t => t * t * (3 - 2 * t);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // the shifted image is continuous across the outer edges but has a seam at the centre
            const sx = (x + (w >> 1)) % w, sy = (y + (h >> 1)) % h;
            const wx = Math.max(0, 1 - Math.abs(x - (w >> 1)) / mx);
            const wy = Math.max(0, 1 - Math.abs(y - (h >> 1)) / my);
            const t = smooth(Math.max(wx, wy)); // weight of the original (continuous at the centre)
            const si = (sy * w + sx) * 4, oi = (y * w + x) * 4;
            for (let c = 0; c < 4; c++) out[oi + c] = Math.round(rgba[si + c] * (1 - t) + rgba[oi + c] * t);
        }
    }
    return { w, h, rgba: out };
}

// ── sheets sometimes come back with a flat panel behind each figure: key the dominant leftover colour too ──
function keyPanels({ w, h, rgba }) {
    const counts = new Map();
    let opaque = 0;
    for (let i = 0; i < w * h; i++) {
        if (rgba[i * 4 + 3] < 200) continue;
        opaque++;
        const q = ((rgba[i * 4] >> 4) << 8) | ((rgba[i * 4 + 1] >> 4) << 4) | (rgba[i * 4 + 2] >> 4);
        counts.set(q, (counts.get(q) || 0) + 1);
    }
    let bestQ = -1, bestN = 0;
    for (const [q, n] of counts) if (n > bestN) { bestN = n; bestQ = q; }
    if (bestQ < 0 || bestN < opaque * 0.12) return { w, h, rgba };
    // the panel colour is a flat fill: average the pixels in that bucket, then key around it
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < w * h; i++) {
        if (rgba[i * 4 + 3] < 200) continue;
        const q = ((rgba[i * 4] >> 4) << 8) | ((rgba[i * 4 + 1] >> 4) << 4) | (rgba[i * 4 + 2] >> 4);
        if (q === bestQ) { r += rgba[i * 4]; g += rgba[i * 4 + 1]; b += rgba[i * 4 + 2]; n++; }
    }
    r /= n; g /= n; b /= n;
    // a panel is a flat fill: nearly every pixel of its colour has neighbours of the same colour.
    // Painterly shading on the figures lands in the same bucket only in scattered specks.
    let interior = 0;
    const inBucket = i => rgba[i * 4 + 3] >= 200 && ((((rgba[i * 4] >> 4) << 8) | ((rgba[i * 4 + 1] >> 4) << 4) | (rgba[i * 4 + 2] >> 4)) === bestQ);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (inBucket(i) && inBucket(i - 1) && inBucket(i + 1) && inBucket(i - w) && inBucket(i + w)) interior++;
    }
    if (interior < n * 0.6) return { w, h, rgba };
    console.warn(`  keying a panel colour rgb(${r | 0},${g | 0},${b | 0}) covering ${(100 * bestN / opaque) | 0}% of the sheet`);
    for (let i = 0; i < w * h; i++) {
        if (rgba[i * 4 + 3] === 0) continue;
        const d = Math.hypot(rgba[i * 4] - r, rgba[i * 4 + 1] - g, rgba[i * 4 + 2] - b);
        const a = Math.min(1, Math.max(0, (d - 18) / 40));
        if (a <= 0) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = rgba[i * 4 + 3] = 0; }
        else if (a < 1) rgba[i * 4 + 3] = Math.round(rgba[i * 4 + 3] * a);
    }
    return { w, h, rgba };
}

// ── if the model drew several rows of figures, keep the tallest band only ──
function keepMainRow({ w, h, rgba }) {
    const rowHas = new Uint8Array(h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > 24) { rowHas[y] = 1; break; }
    const minGap = Math.max(3, Math.round(h * 0.02));
    const bands = [];
    let start = -1, last = -1;
    for (let y = 0; y < h; y++) {
        if (rowHas[y]) { if (start < 0) start = y; last = y; }
        else if (start >= 0 && y - last >= minGap) { bands.push([start, last + 1]); start = -1; }
    }
    if (start >= 0) bands.push([start, last + 1]);
    if (bands.length < 2) return { w, h, rgba };
    bands.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    const [y0, y1] = bands[0];
    console.warn(`  ${bands.length} rows of figures; keeping rows ${y0}-${y1}`);
    for (let y = 0; y < h; y++) if (y < y0 || y >= y1) rgba.fill(0, y * w * 4, (y + 1) * w * 4);
    return { w, h, rgba };
}

// ── sprite sheet: split on transparent column gaps, re-lay into equal square cells ──
function splitSheet(img, expected) {
    img = keepMainRow(keyPanels(img));
    const { w, h, rgba } = img;
    const colHas = new Uint8Array(w);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (rgba[(y * w + x) * 4 + 3] > 24) { colHas[x] = 1; break; }
    // runs of content columns; gaps narrower than 1% of the width do not split a frame
    const minGap = Math.max(3, Math.round(w * 0.01));
    const runs = [];
    let start = -1, lastContent = -1;
    for (let x = 0; x < w; x++) {
        if (colHas[x]) {
            if (start < 0) start = x;
            lastContent = x;
        } else if (start >= 0 && x - lastContent >= minGap) {
            runs.push([start, lastContent + 1]);
            start = -1;
        }
    }
    if (start >= 0) runs.push([start, lastContent + 1]);
    let segs = runs.filter(([a, b]) => b - a > w * 0.03);
    if (segs.length !== expected && expected > 1) {
        // arms, smoke and painted shadows often bridge the gaps: cut instead at the thinnest
        // column near each of the evenly spaced positions the model was asked for
        const colSum = new Float64Array(w);
        for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) colSum[x] += rgba[(y * w + x) * 4 + 3];
        const X0 = segs.length ? segs[0][0] : 0, X1 = segs.length ? segs[segs.length - 1][1] : w;
        const span = X1 - X0;
        // pick the (expected - 1) emptiest columns that are at least 60% of a frame apart,
        // so unevenly spaced figures still get cut between, not through
        const minSep = span / expected * 0.6;
        const chosen = [];
        while (chosen.length < expected - 1) {
            let best = -1, bestV = Infinity;
            for (let x = Math.round(X0 + span * 0.08); x <= X1 - span * 0.08; x++) {
                if (chosen.some(c => Math.abs(c - x) < minSep)) continue;
                if (colSum[x] < bestV) { bestV = colSum[x]; best = x; }
            }
            if (best < 0) break;
            chosen.push(best);
        }
        const cuts = [X0, ...chosen.sort((a, b) => a - b), X1];
        segs = cuts.slice(0, -1).map((c, i) => [c, cuts[i + 1]]);
        console.warn(`  frames touch; cut at even columns instead (${segs.length})`);
    }
    const frames = segs.map(([x0, x1]) => {
        // trim each cell to its own content so the frames centre properly
        let cx0 = x1, cx1 = x0;
        for (let x = x0; x < x1; x++) if (colHas[x]) { cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x + 1); }
        if (cx1 <= cx0) { cx0 = x0; cx1 = x1; }
        x0 = cx0; x1 = cx1;
        let y0 = h, y1 = 0;
        for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) if (rgba[(y * w + x) * 4 + 3] > 24) { y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); break; }
        return { x0, x1, y0, y1 };
    });
    // a cell holding only a sliver (a stray limb from a neighbour) is not a frame
    const widths = frames.map(f => f.x1 - f.x0).sort((a, b) => a - b);
    const median = widths[widths.length >> 1];
    for (let i = frames.length - 1; i >= 0; i--) if (frames[i].x1 - frames[i].x0 < median * 0.35) { console.warn(`  dropping sliver frame ${i + 1}`); frames.splice(i, 1); }
    if (frames.length !== expected) console.warn(`  found ${frames.length} frames, expected ${expected}`);
    if (!frames.length) throw new Error('no frames found');
    const cell = Math.max(...frames.map(f => Math.max(f.x1 - f.x0, f.y1 - f.y0))) + 8;
    const W = cell * frames.length;
    const out = Buffer.alloc(W * cell * 4);
    frames.forEach((f, n) => {
        const fw = f.x1 - f.x0, fh = f.y1 - f.y0;
        const ox = n * cell + ((cell - fw) >> 1), oy = (cell - fh) >> 1; // centred: the game rotates around the centre
        for (let y = 0; y < fh; y++) rgba.copy(out, ((oy + y) * W + ox) * 4, ((f.y0 + y) * w + f.x0) * 4, ((f.y0 + y) * w + f.x1) * 4);
    });
    return { w: W, h: cell, rgba: out, frames: frames.length };
}

// ── box-filter downscale so the shipped files stay small ──────────────
function downscale({ w, h, rgba, frames }, maxW) {
    if (w <= maxW) return { w, h, rgba, frames };
    const k = w / maxW, W = maxW, H = Math.max(1, Math.round(h / k));
    const out = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const x0 = Math.floor(x * k), x1 = Math.min(w, Math.ceil((x + 1) * k)), y0 = Math.floor(y * k), y1 = Math.min(h, Math.ceil((y + 1) * k));
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
            const i = (yy * w + xx) * 4, al = rgba[i + 3];
            r += rgba[i] * al; g += rgba[i + 1] * al; b += rgba[i + 2] * al; a += al; n++; // premultiplied average keeps edges clean
        }
        const o = (y * W + x) * 4;
        if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
        out[o + 3] = Math.round(a / n);
    }
    return { w: W, h: H, rgba: out, frames };
}
const MAX_W = { floor: 512, prop: 512, portrait: 768, sheet: 4 * 320, ui: 640, backdrop: 1200 };

// ── preview over the game background ─────────────────────────────────
function preview({ w, h, rgba }) {
    const out = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        const a = rgba[i * 4 + 3] / 255;
        out[i * 4]     = Math.round(rgba[i * 4] * a + 10 * (1 - a));
        out[i * 4 + 1] = Math.round(rgba[i * 4 + 1] * a + 7 * (1 - a));
        out[i * 4 + 2] = Math.round(rgba[i * 4 + 2] * a + 9 * (1 - a));
        out[i * 4 + 3] = 255;
    }
    return encodePNG(w, h, out);
}

function postProcess(spec, buf) {
    let img = decodePNG(buf);
    img = spec.kind === 'floor' ? makeSeamless(img) : spec.kind === 'backdrop' ? img : chromaKey(img);
    if (spec.kind === 'sheet') img = splitSheet(img, spec.frames);
    return downscale(img, spec.max || (spec.kind === 'sheet' ? 320 * (img.frames || spec.frames) : MAX_W[spec.kind]));
}

// ── main ─────────────────────────────────────────────────────────────
mkdirSync(join(OUT, V2), { recursive: true });
mkdirSync(join(OUT, 'ui'), { recursive: true });
const names = only.length ? only : Object.keys(ASSETS).filter(n => !setArg || ASSETS[n].set === setArg);
let ok = 0, failed = 0;
for (const name of names) {
    const spec = ASSETS[name];
    if (!spec) { console.warn(`unknown asset "${name}"`); continue; }
    const dir = outDir(spec);
    const out = join(dir, name + '.png');
    const rawPath = join(dir, name + '.raw.png');
    const pv = process.env.PREVIEW_DIR;
    try {
        if (REKEY) {
            if (!existsSync(rawPath)) { console.log(`skip ${name} (no raw file)`); continue; }
            const img = postProcess(spec, readFileSync(rawPath));
            writeFileSync(out, encodePNG(img.w, img.h, img.rgba));
            if (pv) { mkdirSync(pv, { recursive: true }); writeFileSync(join(pv, name + '.preview.png'), preview(img)); }
            console.log(`reprocessed ${name}${img.frames ? ` (${img.frames} frames)` : ''}`);
            ok++;
            continue;
        }
        if (existsSync(out) && !FORCE) { console.log(`skip ${name} (exists)`); continue; }
        process.stdout.write(`generating ${name} with ${MODEL}… `);
        const { mime, buf } = await generate(name, spec);
        if (mime !== 'image/png') {
            const rawOut = join(dir, name + '.raw.' + (mime.split('/')[1] || 'bin'));
            writeFileSync(rawOut, buf);
            console.log(`got ${mime}; saved unprocessed to ${rawOut}`);
            failed++;
            continue;
        }
        writeFileSync(rawPath, buf);
        const img = postProcess(spec, buf);
        writeFileSync(out, encodePNG(img.w, img.h, img.rgba));
        if (pv) { mkdirSync(pv, { recursive: true }); writeFileSync(join(pv, name + '.preview.png'), preview(img)); }
        console.log(`ok (${img.w}x${img.h}${img.frames ? `, ${img.frames} frames` : ''})`);
        ok++;
    } catch (e) {
        console.log('FAILED: ' + e.message);
        failed++;
    }
}
console.log(`\n${ok} generated, ${failed} failed. Raw originals are kept as *.raw.png (git-ignored); --rekey reprocesses them.`);
