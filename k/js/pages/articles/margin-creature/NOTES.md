# The page that gestures back: notes for an article

The creature is called **Mooli**, Hindi for radish (मूली), named on 17 October
2026, after the bunny became the default. It knows its name: selecting "Mooli"
on a page it is on gets "dats mi! mooli!", and the bunny sometimes greets you
with "bwee-lo! mi mooli.".

Mooli is on **every page except the tools and games**: one creature per visit, kept
across client-side navigation (`k/js/components/mooli.js`, hooked in via
`app.onRender`). Routes opt out with `mooli: false` in `k/js/routes.js` (snake,
p2p chat, BVH viewer, I Think Therefore I Am, test), where it is hidden and
paused rather than destroyed. Each page change clears radishes and attention and
it walks to the new text column. Colour comes from `--creature`: `#1a8f8a` on
the light home page, `#4fc2bb` site-wide on the dark pages.

Working notes on the home page creature at prat.ee/k: what it is, how it was
built, how it was tested, what changed along the way and why, and what to read.
Collected 17 October 2026, the day it was built. Nothing here is published;
the article itself is still to be written.

The code: `k/js/components/margin-creature.js` (the creature, no dependencies)
and `k/js/pages/home.js` (the page that hosts it). Screenshots are in
`sheets/`, the scripts that made them in `tests/`.


## 1. The idea

The home page is plain text in one serif, with a lot of white space. In the
margin lives a small creature that behaves like an embodied conversational
agent. It makes co-speech gestures while you read: a beat on stressed words,
a point at the link you hover, an iconic or metaphoric gesture for some
projects. Most visitors will take it for a charming detail. People who know
the field will see that the site is itself the research demo, a nod to
Justine Cassell's work on gesture as a communicative channel, and the page
never explains it.

The brief was "super cool and nice yet minimalistic".


## 2. How it evolved, in order

1. **Stick figure in an SVG.** A few strokes and three dots, sitting in the
   page's margin column and driven by springs. It had the four gesture types
   (beat, deictic, iconic, metaphoric) and gestures for particular projects:
   a T-pose for the BVH viewer (the calibration pose every motion-capture
   take starts with), a director's frame for the short film, hand to chin
   for the thought canvas. *Lesson:* pointing at something far below reads
   as "arm hanging down", so the figure walks along the margin to stand level
   with what it points at. *Screenshots of this stage were not kept.*
2. **The margin creature.** Prateek replaced the stick figure with a round
   blob with big eyes, little feet and stubby arms, drawn on its own fixed
   canvas so it can go anywhere. It keeps the gesture vocabulary and adds
   pet behaviour: petting, carrying, throwing, food, sleep, and mischief
   (now and then it sits on the link you were heading for).
3. **Aliveness pass** (see section 4): saccades, anticipation, squash and
   stretch, follow-through, a sprout on its head, rubber-hose arms, a ground
   shadow, a face that turns, cheeks, asymmetric breathing.
4. **New reactions:** it gets dizzy if you circle it, giggles if you scrub
   across it, reads along when you select text, watches where your pointer
   left the window, waves when you come back, and gets sleepier after 11pm.
5. **Colour.** It started in the page's ink, went vermilion ("a seal stamped
   in the margin"), then settled on a greenish blue: `#1a8f8a` in light mode
   and `#4fc2bb` in dark. It is the only colour on the page. Its pupils and
   shadow stay in the ink.
6. **Speech in a made-up language.** The same feelings always get the same
   words, so a regular visitor half-learns it: *bwee-lo* (hello), *ba-bai*
   (bye), *bapa* (good), *nom* (food). Exclamations go in a speech bubble,
   musings in a thought cloud. The bubble types itself out and the mouth
   opens on each vowel as it goes (a crude lip sync).
7. **Food.** Clicking blank space drops a radish (Prateek's SVG, drawn on the
   canvas from its paths). The creature fetches and eats it.
8. **Speech bubble, version 2** (`sheets/speech/`). The first was a stark ink
   outline. It became a wash of the creature's own colour with a teal
   outline: a pill with a curved tail, and a real scalloped cloud for
   thoughts. Each letter hops in as it is typed.
9. **Text-aware reactions.** Selecting text used to get a generic "mm...
   yes... sooo.", which made no sense. Now it reacts to what you selected:
   "software engineer" gets *bip-bop! codo!*, "digital humans" gets *oh!
   like mi!*, "film" gets *kino! popcorni?*. Anything it doesn't know, it
   echoes back in its accent (*gothic-o?*).
10. **A proper meal and a belly** (`04-meal-sequence.png`,
    `05-belly-before-after.png`). It grabs the radish, chews three bites
    with it held under its chin (bits fly, cheeks puff), gulps, and pats its
    belly. Each radish fills it by a quarter and it digests one about every
    40 s. The third radish brings "full-a", the fourth a BUURP and a
    "sorry-a", and after that it refuses food. Fat goes on the **belly, not
    the whole body**: the lower half of the outline widens and sags while
    the head stays the same, a lighter belly patch and a belly button
    appear, its feet spread and it waddles.
11. **The double-click flip** (`06-flip-sequence.png`). This replaced a
    tilt-spring kick that made triple clicks look broken (see bugs).
12. **Personalities**, chosen with `?pet=pup|cat|bunny` (sheets 01–03):
    - *Pup:* the sprout wags like a tail. It tilts its head at you,
      play-bows then pounces at your pointer, gets the zoomies after food or
      a fuss, and follows you keenly.
    - *Cat:* it ignores about half of what you point at, slow-blinks at you,
      sits in a loaf, grooms, kneads while petted and leaves after about 3 s
      ("hmph."), stalks a slow pointer with a bottom wiggle, and bats its
      food about.
    - *Bunny:* the sprout is an ear, up when alert and flopped when relaxed.
      Its nose twitches. It does a twisting "binky" leap when happy, thumps
      when startled, flops over when content, and carries food home over its
      head before eating it.

    Recommendation at the time: the bunny. It is already a round thing with
    a sprout that eats radishes, and bunny habits make all of that look
    intended. **Prateek agreed, and the bunny became the default**
    (`?pet=pup`, `?pet=cat` and `?pet=none` still switch).
13. **The bunny, checked against rabbit research** (sheets 09 and 10, and
    section 9). Several first guesses were wrong. It used to bolt and then
    thump; real rabbits freeze, thump, then bolt. Its ears used to stand up
    when scared; up means alert, and fear pins them flat. Its nose twitched
    on a timer; now sniffing tracks arousal. New behaviours: chin-marking
    links it hasn't met, periscoping on its hind legs when something
    changes, trancing when held too long (which is fear, not calm), and
    frisky laps that end in a binky.


## 3. How it is built

- **Canvas, not SVG.** It draws on one fixed, full-window canvas with
  `pointer-events: none` and hit-tests its own body. A full-window canvas
  lets it walk anywhere and keeps the page's markup untouched.
- **Everything is a spring.** Position, squash and stretch (`sx`, `sy`),
  scale, tilt, gaze, eyelids, mouth, cheeks, arm angle and reach, belly,
  ear, wag. Each frame, a decision function sets targets; critically damped
  springs (with some overshoot) chase them, in fixed 1/120 s substeps so slow
  frames don't explode.
- **A priority chain decides what it does.** Roughly: flipping > being
  carried > thrown > fleeing > dizzy > giggling > eating > carrying food home
  > refusing food > fetching food > attending a link > reading a selection >
  sitting on a link > being petted > a personality habit > asleep >
  inspecting > idling (following, wandering, fidgets). Entering a mode can
  trigger a line of speech.
- **Gestures are functions** of time and the direction to the target.
  Deictics use real geometry (the angle from the shoulder to the link).
- **Impulses, not poses, for beats.** A beat is a velocity kick (a hop and a
  nod) and the springs supply the stroke and the settle. Anticipation: every
  jump crouches first and launches 70 ms later.
- **Secondary motion.** The sprout is a free point on a spring hanging off
  the head, so it trails every move. Arms are quadratic curves that bend
  against their own angular velocity (rubber hose).
- **Eyes lead, the body follows.** Gaze springs are stiff (fast); the body
  tilts toward the gaze on a slower spring. Saccades: every 0.3–2.6 s the
  eyes jump by a small random offset and hold.
- **Belly fat** is a function of the outline points: for points on the lower
  half (`sin(angle) > 0`), x widens by `1 + 0.5·b·s^1.1` and y sags by
  `1 + 0.22·b·s`, where `b` is the belly spring and `s` how far down the
  point is.
- **Speech** is drawn on the same canvas. The bubble's outline is drawn by
  stroking every shape at twice the width and then filling every shape on
  top, so only the outer half of the stroke survives and the pieces merge
  without seams. Colours are mixed in JS from the page's computed `color`,
  `background` and `--creature`, so it follows the theme.
- **Reduced motion:** with `prefers-reduced-motion` it draws once and never
  animates or speaks.


## 4. What makes it feel alive: the principles used

From traditional animation (Thomas and Johnston's twelve principles), done
procedurally:

| Principle | Where |
|---|---|
| Squash and stretch | landing, hopping, gulping, scroll "wind"; capped so it can't pancake |
| Anticipation | the crouch before every jump; the play bow and stalk before a pounce |
| Follow-through, overlapping action | sprout on a spring; rubber-hose arms lag their swing |
| Slow in, slow out | eased flip; springs everywhere |
| Secondary action | breathing, blinking, nose twitch, tail-wag sprout |
| Appeal | big eyes, cheeks, a belly button, a language of its own |

From embodied conversational agents:

| Idea | Where |
|---|---|
| Four gesture types (McNeill): beat, deictic, iconic, metaphoric | beats on emphasised words, pointing at links, the T-pose, the director's frame |
| Gesture phases (preparation, stroke, hold, retraction) | the stroke lands just as you reach the word; a hold and a slow retraction after hover |
| Gaze leads action | eyes reach the link before the arm does |
| Backchannel | a nod when you pause scrolling |
| Turn-taking gaze | it looks back at you after attending to something |
| Posture shift at topic boundaries | a hop when a heading crosses the reading line |


## 5. How it was tested

There was no manual clicking. Everything was checked in a real browser driven
by a script:

- **Headless Microsoft Edge via `playwright-core`**, against a tiny static
  file server over the repo. Viewports: 1280×800 or 1440×900 at 2–4× pixel
  ratio for close-ups, 390×844 for phone, light and dark colour schemes.
- **Finding the creature.** The script reads the canvas back
  (`getImageData`) and takes the bounding box of drawn pixels. Later it used
  only teal pixels, so speech bubbles and radishes didn't count.
- **Hearing what it says.** An init script wraps
  `CanvasRenderingContext2D.prototype.fillText` and logs every string drawn.
  That is how speech was checked ("radish 4: oof. biggo belly. | BUURP! |
  ...sorry-a.").
- **Contact sheets.** Frames are captured every 70–110 ms and laid out in a
  grid by `tests/sheet.mjs` to read an animation at a glance (the meal, the
  flip, the personalities).
- **Synthetic input** for gestures that are hard to perform with a mouse
  driver: `PointerEvent`s dispatched in a circle (dizzy), a programmatic
  `Range` selection (reading along), rapid back-and-forth moves (giggle).
- **Repeating a failure.** An intermittent error was reproduced by
  re-running the exact scenario that produced it (a click on a list item, so
  no food dropped), then capturing `pageerror` stacks.

The scripts in `tests/` are as used. They hard-code `E:/prateek` and the Edge
path, and need `playwright-core` installed next to them (`npm i
playwright-core`).


## 6. Bugs worth telling

- **Dizzy never fired.** It counted how far the pointer travelled *around
  the creature*, but near the margin the creature follows the pointer, so
  the angle barely changed. The fix measures the pointer's own heading
  instead: two full loops of its path, wherever the creature is.
- **Reading along sat one line too high.** A selection that starts in the
  whitespace between lines has its first client rect at the end of the
  previous line. The fix skips past leading whitespace before measuring.
- **The speech-bubble tail showed a seam.** The pill and the tail were traced
  in opposite directions, so their overlap cancelled out under the nonzero
  fill rule. Each shape is now filled on its own.
- **It ate the fifth radish.** The refusal threshold sat too close to where
  the burp happened, and in the 20 s of the test it had digested just below
  it. Refusal moved to 0.8 full.
- **Triple click smeared it into a line.** Each click added its own squash
  impulse, and three stacked until `sy` went near zero. A double-click also
  kicked the tilt spring into a wild swing, and the clicks passed through
  the canvas and selected the paragraph underneath, which sent it off to
  "read". Fixes: capped squash and a clamped shape, a tap counts as a "boop"
  rather than a drop, an eased flip that can't stack, and `mousedown`
  `preventDefault` over the creature.
- **It froze and vanished for good.** If the pointer left the window while
  over it, `ptr.x` was cleared but `ptr.over` wasn't. The next frame entered
  the petting branch with no pointer and threw on every frame after. This
  was in the module from the start and was found by the personality tests.
- **Canvas sized wrong in the BVH viewer** (same day, different page): the
  canvas only resized on window `resize`, so a size measured mid-layout
  stuck. The fix is a `ResizeObserver`, with the canvas absolutely
  positioned so it can't hold its box open.


## 7. References

**Read or checked during the build** (found by web search on the day):

- Willett, N. S., Li, W., Popović, J., Berthouzoz, F., Finkelstein, A.
  (2017). *Secondary Motion for Performed 2D Animation.* UIST 2017.
  https://gfx.cs.princeton.edu/pubs/Willett_2017_SMF/paper.pdf
  (secondary motion as swaying, jiggling, trailing; rigs that propagate
  primary motion into layered art)
- Lee, S. P., Badler, J. B., Badler, N. I. (2002). *Eyes Alive.* ACM
  Transactions on Graphics 21(3), SIGGRAPH 2002.
  https://www.cis.upenn.edu/~badler/papers/EyesAlive.pdf
  (a statistical saccade model; stationary or random eyes read as less
  natural)
- Jörg, S., et al. (2018). On adding noise to eye rotation and pupil size,
  and perceived naturalness of virtual characters. University of Bamberg.
  https://www.uni-bamberg.de/fileadmin/cg/publications/joerg18/Joerg18_jitterAdjustment.pdf
  (only the summary was read; check the full text and exact title before
  citing)
- *Procedural Animation in Games.*
  https://www.abratabia.com/game-animation/procedural-animation.php
  (springs for secondary motion instead of hand-authoring it)
- oneko, the X11 desktop cat that chases your pointer, in the Debian package
  listing: https://appstream.debian.org/stretch/main/metainfo/oneko.html
  (the lineage of desktop pets)

**Standard works, cited from memory** (check editions and pages before
publishing):

- Cassell, J., Sullivan, J., Prevost, S., Churchill, E. (eds.) (2000).
  *Embodied Conversational Agents.* MIT Press.
- Cassell, J. (2000). Embodied conversational interface agents.
  *Communications of the ACM* 43(4).
- McNeill, D. (1992). *Hand and Mind: What Gestures Reveal about Thought.*
  University of Chicago Press. (The beat, deictic, iconic and metaphoric
  taxonomy.)
- Kendon, A. (2004). *Gesture: Visible Action as Utterance.* Cambridge
  University Press. (Gesture phases: preparation, stroke, hold, retraction.)
- Thomas, F., Johnston, O. (1981). *The Illusion of Life: Disney Animation.*
  Abbeville Press. (The twelve principles.)
- Penner, R. (2002). *Programming Macromedia Flash MX*, the easing equations
  (the bounce used when a radish lands).


## 8. Open questions for the article

- The bunny is now the default. Is any pup or cat habit worth keeping on
  top of it?
- Should the page ever hint at the creature? So far, deliberately never.
- How it behaves on touch screens has not been tested on a real device.
- Whether to show the gesture taxonomy in the article (the table in
  section 4) or keep the article as light as the page.


## 9. The bunny, and what rabbit research says

Each bunny behaviour, what it is based on, and how strong that basis is.
**Strong** means a peer-reviewed study or scientific review; **moderate**
means veterinary or welfare-body guidance; **weak** means pet-care pages
that agree with each other but cite nothing.

| Behaviour in the creature | What rabbits do | Evidence |
|---|---|---|
| A startle makes it **freeze** (still, wide-eyed, ears up), then **thump**, then **bolt** | Frightened rabbits thump the ground with their hind feet as an alarm to others; ancestral defence was freezing, hiding, then escaping underground | Strong (review) and moderate (vet review) |
| **Ears pinned flat** when afraid (fleeing, held, thrown); **up** when alert; **flopped** when relaxed | Crouched with ears flattened reads as fear; ear shape and position is one of the five units of the Rabbit Grimace Scale (a pain measure) | Moderate (RSPCA) and strong (grimace scale) |
| **Chin-rubs** a link the first time it meets it ("mine-a.") | Rabbits chin-mark with scent glands; marking is triggered by novel objects, rises around unfamiliar scent, and is linked to dominance | Strong (several Ethology and Physiology & Behavior papers) |
| **Periscopes** (up on hind legs, scanning) when the pointer leaves or now and then | Vigilance rises with threat; rabbits stand on their hind legs to look and listen | Moderate (a field study of vigilance; standing up is from an NPS fact sheet, not a study) |
| Held for more than about a second, it goes **rigid and still** (a trance), then thumps and bolts when let go | Tonic immobility is a fear-motivated last defence, longer in more fearful rabbits. It is **not** relaxation, which is why "trancing" pet rabbits is discouraged | Strong (several welfare studies) |
| **Frisky laps** ending in a **binky** after food or a fuss | Locomotor play (running, twisting leaps) is read as a positive emotional state; it is commoner in young rabbits and where there is room to move | Strong (EFSA report; survey of English pet rabbits) for play as positive; weak for the binky's exact meaning |
| **Loafs** (paws tucked) and **flops** onto its side when at ease | Sitting with legs tucked or lying stretched out shows ease; flopping shows comfort and security | Moderate (PDSA) and weak (pet-care sites) |
| The **nose sniffs faster** when alert, slows when relaxed, stops when flopped or frozen | Sniffing is fast, breath-locked nose movement when exploring, slow when at rest. Shown in rats; I found no measured rabbit study | Strong in rats; weak for rabbits (the "150 twitches a minute" figure is unsourced) |
| **Carries food home** before eating | Not a documented rabbit habit as such; a creative liberty | None; it's a liberty |

One thing worth saying in the article: the research shows how often a cute
reading of rabbit behaviour is wrong. A rabbit lying still on its back
looks calm and is terrified. That is a nice parallel with reading gesture in
agents: the signal and the obvious interpretation can come apart.

### Sources for this section (all found by web search on 17 October 2026)

Studies and reviews:

- *Rabbit Basic Science* (review, PMC, NIH; author not checked).
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7158370/
  (thumping as an alarm signal; warrens)
- dvm360, *Understanding rabbit behavior and preventing and treating
  behavior problems.*
  https://www.dvm360.com/view/understanding-rabbit-behavior-and-preventing-and-treating-behavior-problems
  (freezing, hiding, escaping underground)
- *The Behavioural Repertoire of the Domestic Rabbit* (MSc thesis, Utrecht
  University, 2025), a full ethogram, open access.
  https://studenttheses.uu.nl/handle/20.500.12932/48840?show=full
- Gunn, D., Morton, D. B. (1995). Inventory of the behaviour of New Zealand
  White rabbits in laboratory cages. *Applied Animal Behaviour Science*
  45, 277–292.
  https://refinementdatabase.org/publications/inventory-of-the-behaviour-of-new-zealand-white-rabbits-in-laboratory-cages
- Martínez-Gómez, M., et al. (1997), chin marking in male and female
  domestic rabbits, *Ethology*. Plus the 2008 dominance and 2010 novelty
  chinning studies, via PubMed: https://pubmed.ncbi.nlm.nih.gov/19857527/
  and the Pherobase listing:
  https://pherobase.com/literature/data/details/C/36022
  (check exact titles and authors before citing; I saw summaries only)
- Hayes, R. A., et al., *Semiochemicals and social signalling in the wild
  European rabbit.*
  https://researchers.westernsydney.edu.au/en/publications/semiochemicals-and-social-signalling-in-the-wild-european-rabbit-/
- Urban cottontail vigilance and predators (2021), *Frontiers in Ecology
  and Evolution.*
  https://www.frontiersin.org/journals/ecology-and-evolution/articles/10.3389/fevo.2021.570734/full
- Trocino, A., et al. (2013). Housing of growing rabbits in individual,
  bicellular and collective cages: fear level and behavioural patterns.
  *Animal.*
  https://www.cambridge.org/core/journals/animal/article/abs/housing-of-growing-rabbits-in-individual-bicellular-and-collective-cages-fear-level-and-behavioural-patterns/B87B182179729EFFA245316791F98C8D
- EFSA (2020). Health and welfare of rabbits farmed in different production
  systems. *EFSA Journal.* https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2020.5944
- Rooney, N. J., et al. (2014). The current state of welfare, housing and
  husbandry of the English pet rabbit population. *BMC Research Notes* 7:942.
  https://link.springer.com/article/10.1186/1756-0500-7-942
- Behaviour of domestic rabbits during 2 weeks after weaning (2019),
  *Archives Animal Breeding.* https://pmc.ncbi.nlm.nih.gov/articles/PMC6852857/
- Keating, S. C. J., et al. (2012), the Rabbit Grimace Scale; an overview is
  at https://en.wikipedia.org/wiki/Grimace_scale and the tattooing study at
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7600890 (check which paper that
  link is before citing)
- Kurnikova, A., et al. (2017). Coordination of orofacial motor actions into
  exploratory behavior by rat. *Current Biology.*
  https://neurophysics.ucsd.edu/publications/PIIS0960982217300131.pdf
  (sniffing above 4 Hz versus basal breathing below 2 Hz; rats, not rabbits)

Welfare bodies and guides (moderate to weak):

- PDSA, *Rabbit body language.*
  https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/rabbit-body-language
- RSPCA, *What does my rabbit's behaviour mean?*
  https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/behaviour/understanding
- Toronto Humane Society, *Why do rabbits binky?*
  https://www.torontohumanesociety.com/why-do-rabbits-binky/
- National Park Service, Eastern cottontail facts.
  https://www.nps.gov/home/eastern-cottontail-rabbit-fun-facts.htm

Leave out: several search results were content-farm pages (on thumping and
nose twitching) with no sources. None of them are cited here.


## 10. Lineage: virtual pets and desktop mascots

Added to the article as "Where it comes from" (found by web search on
17 October 2026):

- **Neko**: a cursor-chasing cat for NEC PC-9801 machines in the 1980s
  (attributed to Naoshi Watanabe by a Chinese-language overview, so treat
  the name as unconfirmed); a Mac version; **xneko** for X by Masayuki Koba
  (OpenBSD ports date it 1990); **oneko** by Tatsuya Kato.
  https://pkgsrc.se/x11/oneko · https://openports.pl/path/games/xneko ·
  https://mirrors.nycbug.org/pub/The_Unix_Archive/Unix_Usenet/alt.sources.d/1991-March/000626.html
- **Little Computer People**: Activision, 1985 (David Crane).
- **Dogz** (1995) and **Catz** (1996): PF.Magic. https://en.wikipedia.org/wiki/Dogz
- **Tamagotchi**: Bandai, Japan, 23 November 1996; Akihiro Yokoi (WiZ) and
  Aki Maita (Bandai); name from *tamago* (egg) and "watch" by Bandai's
  account; the 1997 Ig Nobel Prize in economics.
  https://en.wikipedia.org/wiki/Tamagotchi
- **Neopets** (1999), **Nintendogs** (2005):
  https://newsroom.activisionblizzard.com/p/unleashed-a-brief-history-of-digital
- **Shimeji**: Yuki Yamada, Group Finity, about 2009, popular in the early
  2010s; *shimeji* is a mushroom. https://dic.pixiv.net/en/a/Shimeji ·
  https://fanlore.org/wiki/Shimeji

The Ig Nobel citation wording ("diverting millions of man-hours of work into
the husbandry of virtual pets") is quoted from memory; the article
paraphrases it.

**Still to do:** Prateek's own memory from around 2010 goes where the
article has the `<!-- YOUR MEMORY ... -->` comment, in "Where it comes from".


## 11. Why a rabbit (the reasoning, as argued in the article)

The deciding question was not which animal is cutest but which animal's
behaviour suits a web page, where the reader is there to read and the
creature is a guest in the margin.

- **Reactive, and legible.** A prey animal's repertoire is noticing change
  and answering it (freeze, thump, periscope, chin-mark new things), which
  maps almost one to one onto page events: the pointer rushing in, leaving
  the window, a link it hasn't met. Each reaction is short and unmistakable
  at margin size.
- **A readable state channel.** The sprout as an ear (up, flopped, pinned)
  reads at about 20 px; ear position is a unit of the Rabbit Grimace Scale.
- **Calm by default.** Rabbits rest a lot (loaf, flop) and save play for
  after something good: quiet while you read, lively when you act.
- **The other two failed the page.** The pup was too much (follows you,
  pounces, zoomies after most meals); the cat was too little (ignores about
  45% of the links you point at, leaves after about 3 s of petting). A
  gesture agent that ignores half of what you point at fails its one job.
- **It asks you to be gentle.** Holding it too long makes it trance, then
  thump and bolt, which nudges people from dragging towards feeding and
  stroking.
- **It was already halfway there:** round, a sprout on its head, and it eats
  radishes.


## 12. Mooli as a sketch of an AI agent's avatar

Added to the article as "An avatar for an agent" (sources found by web
search on 17 October 2026):

- **Clippy** (Office 97): crude triggers ("Dear" offered letter help),
  interruptions; off by default by Office XP. Lesson: not "no characters"
  but "no interruptions". https://gigazine.net/gsc_news/en/20220913-office-assistant-clippy
- **Mico** (Microsoft Copilot voice mode, 2025): a blob whose colour and
  expression follow the conversation's tone; a hidden Clippy reaction when
  tapped quickly.
  https://www.scmp.com/tech/big-tech/article/3330137/new-clippy-microsoft-unveils-mico-ai-character-embodying-its-copilot-assistant
- **Grok companions** (xAI, mid-2025): Ani and Rudi the red panda; heavily
  criticised. https://www.nbcnews.com/tech/internet/grok-companions-include-flirty-anime-waifu-anti-religion-panda-rcna218797
- **Meta Muse** (September 2026): an agent with the default avatar Jolly;
  the Muse Charm keychain ("Tamagotchi-like", TechCrunch, 23 September
  2026). https://techcrunch.com/2026/09/23/meta-made-a-tamagotchi-like-wearable-for-its-muse-ai-agent/
- **OpenAI's Dots** (2026), and the trust debate: Fortune (2 October 2026),
  Bloomberg (13 October 2026), Fairplay's 30 September complaint to the FTC.

The four design principles the article draws from Mooli: point at what you
are about to act on (deixis as transparency); be quiet until needed; show
state at a glance (ears, mapped to working, waiting, unsure, stuck); never
perform a feeling you do not have (the trance lesson).


## 13. Pets now (who else is doing this, October 2026)

Added to "Where it comes from" in the article. Found by web search on
18 October 2026; "I didn't find" is not "it doesn't exist".

- **Bongo Cat** (Irox Games, Steam, 2025): taps along as you type; peak near
  195K concurrent players; developer says it isn't profitable and about half
  of daily players are bots.
- **On websites**: oneko.js and offshoots (spawn-a-neko, svelte-neko);
  desksprite (grab, throw, seat a mascot); agent-pet (an avatar widget for web
  apps with thinking, success and error states and speech bubbles).
- **Browser extensions**: Browser Pet (walks to paragraphs and eats them,
  opt-in), PixelCat (reacts on YouTube and Google only), Tabagotchi (health
  tied to open tabs), Pawly (deliberately does not read the DOM).
- **AI coding tools**: Claude Code's `/buddy` (a Tamagotchi-style terminal
  pet, 2026), codachi and other community pets, Petdex (Codex companions).

Mooli's difference, as argued in the article: almost all of these react to
*you* (typing, cursor, tabs, app state), not to *what you are reading*.
Extensions that could read pages need access to every page you open; Mooli
lives on its own site, so it reads its own pages and nothing else.


## 14. Tidying: things come loose and Mooli puts them straight

Now and then (see section 15 for when), one small thing in view slips a few degrees
crooked (a link, an emphasised word, a heading, a list item, an image, a stat
box), sagging from one end as if it had come off its line. Mooli notices after
0.7–1.4 s ("oop! wonky." / "hmm? crooki!" / "uh-oh. tilta."), goes over
(beside it if it starts its line, perched above if it is mid-line), gives it
two nudges, and it springs back with a little overshoot ("dere. fixa." /
"tidy-tidy!" / "ta-da! straighta."). The element's own style attribute is
restored exactly afterwards.

Guardrails: never while Mooli is busy (eating, carried, asleep, reading a
selection, carrying food, fleeing, flipping, already tidying); never with
reduced motion; never on a hidden tab; and if Mooli is distracted the item
straightens itself after 10 s, so the page is never left broken.

Split: the creature has a generic `pet.fix(el, done)` and a `pet.busy`
getter; `bindPage` decides what slips and how (`tidy`, `tidySelector`
options; `data-no-tidy` on anything that must never move).


## 15. Carrot viruses, the fight cloud, and when things happen

**Carrot viruses.** A little carrot pops out of the page beside a word (or on
the first line of a paragraph) with a puff: orange body with ridges, a spiky
leafy crown (the "virus" part), angry slanted brows. It walks to the word and
chews it, flecks of ink flying off. Mooli spots it ("eep! carroto!" / "bad
veggie!" / "oi! shoo, carroto!"), narrows its eyes, puts its fists up and
charges. They vanish into a **cartoon fight cloud**: a shaking dust ball,
re-rolled 14 times a second so it boils, with teal fists and orange carrot feet
poking out, gold stars, and POW! BONK! THMP! ZAP! popping out of the top. After
1.5 s the carrot is launched off the page spinning and Mooli pops out ("ha!
begone!" / "no carroto here." / "bapa. all clean."). Ignored, a carrot wanders
off on its own after 16 s.

The joke has a basis: carrots are a sugary treat for real rabbits, not a staple,
so the carrot as junk-food villain is accurate rabbit lore. (Rabbits and hares
also really do "box" when they fight.)

API: `pet.germ(x, y, fromX, fromY)`; `pet.busy` is true while a germ is around.

**When things happen (reading-based pacing).** First version: a slip every
40–90 s on a timer. Prateek's point: nobody is idle on a page that long; they
read. Now `bindPage` paces events by reading:
- **long pages** (taller than 2.5 screens, i.e. articles): an event every ~1.3
  screens scrolled, at least 14 s apart, or after 25 s of active reading
  without much scrolling;
- **short pages** (home): first event 12–20 s in, then every 30–50 s;
- only active time counts (a pointer move, scroll or key in the last 6 s),
  never on a hidden tab, never with reduced motion, never while Mooli is busy;
- each event is a slip or a carrot at random (about 55/45), falling back to
  the other if there's nothing suitable in view.

Tested: home, first event at 13.6 s and 19.6 s in two runs; article, events at
15.2 s and 29.2 s while scrolling ~4.5 screens in 28 s. An early run found
no events on articles at all: the article uses `<i>`/`<b>` rather than
`<em>`/`<strong>`, so nothing qualified; the selector now includes `i, b,
code, h4`, and carrots can also land on plain paragraph lines.


## 16. Courier: Mooli carries the files on p2p drop

On 28 October 2026 Mooli got its first job on a tool page. p2p drop
(`/p2pdrop`) sends files browser to browser with a six-character code, and
Mooli plays the courier between two little PCs drawn on the page: "you" on
the left, "them" on the right. It is the one tool route without
`mooli: false`.

What it does, in the order a visitor meets it:
- **Catch.** Drag files over the lobby and it runs into the drop zone, arms up
  and wiggling, hopping on the spot ("gimme! gimme!" / "ooh! filo! filo!").
- **Pack.** Drop them and it hugs a cardboard parcel to its chest, arms
  wrapping round and round ("packa-packa!" / "tapo, tapo!"), then hops it up
  onto its head. The parcel is taped and has a radish stamp on it.
- **Wait.** The sender's Mooli stands by its own PC with the parcel up,
  tapping a foot, and every few seconds goes up on tiptoe to look at the
  empty PC ("where-a?" / "hullo-o? anybodi?").
- **Deliver.** Once bytes move, it shuttles: a parcel pops out of the source
  screen in an arc onto its head, it carries it over (leaning in, a little
  effort in the face) and tosses it into the far screen, which flashes. Then
  it runs back empty-handed, arms swinging. It runs faster the faster the
  transfer is (300 px/s idle pace up to 860 px/s at 4 MB/s and over), and at a
  sprint kicks up dust. The far screen fills with green as the data lands.
- **Stuck.** If nothing has landed for 2.5 s it stops where it is, hugs the
  parcel, droops and looks at the other end ("uh-oh... gone-a?").
- **Done.** Each finished file gets confetti, a flip and "ta-da! deliver-o!" /
  "signa here!". Then it puts any parcel back and goes back to its own life.
- **Grabbed.** Pick it up mid-delivery and the parcel tumbles off its head
  and fades; it goes back for another.

Split: the creature knows nothing about files. It has a generic
`pet.courier(job)`, where `job` is `{ from, to, mine, state, pace, onDrop }`:
two rect functions, which end is the visitor's, a state function ('wait',
'go', 'stuck', 'idle'), a 0–1 pace and a callback as each parcel goes in.
Plus `pet.expect(rect)`, `pet.pack()` and `pet.delivered()`. The page answers
the state questions from its own transfer bookkeeping, so it never has to
push updates. The courier modes sit above attending, petting and feeding in
the priority order, and `pet.busy` is true throughout, so carrots and tidying
leave it alone at work.

**Bugs worth telling.**
- *The pancake.* At courier sprint speed the walk cycle hopped about 7 times a
  second, each landing adding a squash impulse faster than the body spring
  (about 1.4 Hz) could recover, so it ran pinned flat at the squash clamp with
  its arms out. Zoomies had the same latent problem. Fix: the step rate stops
  rising past 520 px/s and each landing's squash scales down with speed.
- *Hired, then forgotten.* Opening a share link starts the receive inside the
  page's first effect, before the site's after-render hook calls
  `pet.newPage()`, which clears whatever belonged to "the old page" and with
  it the brand-new job. The page now keeps the job and gives it back after
  any render where the creature has lost it.
- *Honest animation.* A closed tab does not always say goodbye over WebRTC,
  and the browser can take about 30 s to notice, so Mooli kept cheerfully
  delivering parcels while nothing moved. The state now comes from whether
  bytes are actually landing, not whether the connection claims to be up.

Tested with headless Edge via playwright-core, two browser contexts over the
real public trackers (`mooli-drop.mjs` in the session scratchpad, modelled on
`tests/speak2.mjs`): screenshots of catch, pack, wait, both ends mid-delivery,
delivered, and the sender's tab closed mid-transfer; speech logged through the
`fillText` hook.
