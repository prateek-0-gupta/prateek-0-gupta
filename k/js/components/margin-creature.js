// A small round creature with big eyes, little feet and two stubby arms that
// lives in the margin of a page. It is drawn on its own fixed canvas so it can
// go anywhere, and it behaves the way Cassell's embodied agents do: the arms
// do co-speech gesture (beats, deictics, iconics, metaphorics), the eyes lead
// and the body follows, it looks at what it talks about and back at you when
// it is done, it shifts at topic boundaries and nods when you pause. It also
// follows you, runs away, eats, sleeps, sulks, can be petted, carried and
// thrown, and now and then sits on the link you were going for. Spin the
// pointer round it and it gets dizzy; scrub across it and it giggles; select
// some text and it comes to read along. It is sleepier after 11pm.
//
// What keeps it alive is mostly the twelve principles done with springs:
// anticipation before every jump, squash and stretch, follow-through in the
// rubber-hose arms and the sprout on its head (a free point on a spring),
// eyes that saccade and fixate rather than glide, and the body turning after
// the eyes rather than with them.
//
// No dependencies and nothing site-specific:
//   import { createCreature, bindPage } from './margin-creature.js';
//   const pet = createCreature();           // makes its own fixed canvas
//   bindPage(pet);                          // wires it to the page
//
// The creature on its own:
//   pet.attend(el, gesture?)   go to an element and gesture at it
//   pet.release(el)            let go of it
//   pet.beat()                 a beat: a hop, on a stressed word
//   pet.nod()                  mm-hm
//   pet.shift()                a new topic: hop and resettle
//   pet.wave()  pet.do(name, seconds)   greetings and party tricks
//   pet.feed(pageX, pageY)     drop a radish; it eats it, and gets a belly if you overdo it
//   pet.scroll(dy)             the page moved under it
//   pet.read(rect | null, text?)  read along with whatever rect() returns, and say what it makes of text
//   pet.fix(el, done)          go and put something straight; done() is when it springs back
//   pet.germ(x, y, fromX, fromY)  a carrot virus pops out and heads for (x, y); it gets chased off
//   pet.say(key | text)        say one of its words (hello, cheer, look...) or anything
//   pet.courier(job | null)    carry parcels from one element to another (see api.courier)
//   pet.expect(rect | null)    something is about to be dropped there: arms up, ready to catch
//   pet.pack()  pet.delivered()   wrap a parcel up; a delivery landed, hooray
//   pet.sleep()  pet.wake()  pet.destroy()
// Pointer things (looking at you, following, fleeing, petting, dragging,
// throwing, mischief) it handles itself, because it needs to hit-test its own
// body. bindPage adds the page semantics: links are attended with the gesture
// named in data-gesture, stressed words (em, strong) get beats on hover and as
// they pass the reading line, headings shift it, scrolling braces it, clicking
// blank space drops a radish for it, a hidden tab puts it to sleep, and it waves on arrival.
//
// Pass personality: 'pup' | 'cat' | 'bunny' to give it an animal's habits too.
//
// Gestures for data-gesture: point (default), snake, frame, tpose, think,
// exchange, wave, conduct, big, small.
//
// It draws in the page's own `color` on the page's own `background`, so it
// follows your theme. Set --creature on body (or an ancestor) to give the body
// its own colour; the pupils and shadow stay in the page's ink.

const PI = Math.PI, TAU = 2 * PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const nowS = () => performance.now() / 1000;

const spring = (v = 0) => ({ v, vel: 0, t: v });
const tick = (s, k, z, dt) => { s.vel += (k * (s.t - s.v) - 2 * Math.sqrt(k) * z * s.vel) * dt; s.v += s.vel * dt; };

export function createCreature({
  canvas = null,
  radius = 17,          // body radius, px
  margin = 46,          // where it lives, px from the left edge
  sleepAfter = 42,      // seconds alone before it sleeps
  mischief = true,      // whether it ever sits on a link you are heading for
  links = () => document.querySelectorAll('a[href]'),   // what counts as a link, for mischief
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches,
  font = null,          // typeface for its speech; defaults to body's
  talk = true,          // whether it says things at all
  personality = null,   // 'pup', 'cat' or 'bunny' for an animal's habits on top of its own; null for neither
} = {}) {
  const R = radius, N = 20, ARM = R * 0.95;
  let MARGIN = margin;
  let active = true;                                       // false: hidden and paused (see setActive)
  const SHOULDER = [{ x: R * 0.72, y: R * 0.02 }, { x: -R * 0.72, y: R * 0.02 }];
  const REST_ARMS = [[0.85, 0.5], [PI - 0.85, 0.5]];   // [angle, reach]; the right arm lives near 0, the left near π

  const own = !canvas;
  if (own) {
    canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');

  const S = {
    sx: spring(1), sy: spring(1), sc: spring(1), tilt: spring(0),
    look: [spring(0), spring(0)], lid: spring(1),
    happy: spring(0), scared: spring(0), mouth: spring(0),
    arms: [[spring(REST_ARMS[0][0]), spring(REST_ARMS[0][1])], [spring(REST_ARMS[1][0]), spring(REST_ARMS[1][1])]],
  };
  const wob = new Array(N).fill(0), wobV = new Array(N).fill(0);
  const p = { x: MARGIN, y: innerHeight * 0.4 }, v = { x: 0, y: 0 };
  let hop = 0, hopPhase = 0, t = 0, last = 0, raf = 0;

  let fg = '#000', ink = '#000', bg = '#fff', colourAt = 0;
  const readColours = () => {
    const cs = getComputedStyle(document.body);
    ink = cs.color; bg = cs.backgroundColor;
    fg = cs.getPropertyValue('--creature').trim() || ink;
    if (!font) fontFamily = cs.fontFamily;
  };

  // ── what it knows about you ──
  const ptr = { x: null, y: null, vx: 0, vy: 0, moved: 0, over: false, overSince: 0 };
  let lastActivity = nowS();
  let attended = null, afterAttend = 0;
  let carried = null, thrownUntil = 0;
  let fleeUntil = 0, fleeTo = null, waryUntil = 0;
  let inspect = null, nextInspectAt = 0;
  let block = null, nextBlockAt = nowS() + 30;
  let crumbs = [], eating = null;
  // fullness: each radish adds a quarter, digestion takes it away again over a
  // few minutes, and the belly shows it (a spring, so it swells after a gulp and
  // wobbles as it settles). Past FULL it turns food down.
  const FULL = 0.8, PER_RADISH = 0.25, DIGEST = 0.0065;   // per second: a radish every ~40s
  let full = 0, bits = [];
  const belly = spring(0), puff = spring(0);              // belly fat, cheeks puffed while chewing
  let refuse = null;                                       // { until }: no-no, full
  let asleep = false, zs = [], nextZ = 0;
  let fidget = null, nextFidgetAt = nowS() + 5, nextBlinkAt = nowS() + 2;
  let wander = null, wanderUntil = 0;
  let wind = 0, arrived = false, swallowClick = false;
  let dizzyUntil = 0, giggleUntil = 0;
  const circling = { a: null, turned: 0, since: 0 };     // pointer orbiting it: how far round, since when
  const wiggle = { dir: 0, flips: [] };                   // pointer scrubbing back and forth over it
  let reading = null;                                     // { rect: () => DOMRect | null, since, line }
  let exit = null;                                        // where the pointer left the window, and when
  const later = [];                                       // [{ at, fn }]: timed impulses, run by the loop
  const hour = new Date().getHours(), night = hour >= 23 || hour < 6;
  if (night) sleepAfter *= 0.6;                           // past bedtime it nods off sooner

  // eyes dart and fixate rather than glide; the body turns after them
  const sac = [spring(0), spring(0)];
  let nextSaccadeAt = nowS() + 1;
  const face = spring(0);                                 // -1..1: which way it has turned
  // a sprout on its head, a free point on a spring, so it trails every move
  const tip = { x: MARGIN, y: innerHeight * 0.4 - R * 1.8, vx: 0, vy: 0 };

  // ── speech: a little language of its own ──
  // The same feelings always get the same words, so a regular visitor starts
  // to pick it up (bwee-lo is hello, ba-bai is bye, bapa is good, nom is food);
  // in between it babbles. Exclamations come in a speech bubble, musings in a
  // thought cloud. The mouth flaps on the vowels as the letters come out.
  const WORDS = {
    hello:    ['bwee-lo!', 'bwee-lo! bwee-lo!', 'oh! bwee-lo!'],
    cheer:    ['ba-bai!', 'ba-bai, ba-bai!', 'go-go! ba-bai!'],
    look:     ['looka!', 'dis one!', 'ooh, ta!', 'lookee!'],
    snake:    ['sssnek!', 'ssss... nagi!'],
    frame:    ['kino... kino!', 'ah. cinemo.'],
    tpose:    ['bip. calibrato.', 'tee-pose. bip.'],
    think:    ['hmmm... cogito?', 'mmm... pondo.'],
    exchange: ['psst! pass-a!', 'tikka, takka!'],
    wave:     ['bwee-lo! bwee-lo!', 'oh, bwee-lo!'],
    conduct:  ['la-la-pum!', 'pum, pum, la!'],
    big:      ['BOOMBA!', 'sooo grandi!'],
    small:    ['teeny-tiki.', 'mini-mi.'],
    dizzy:    ['wuh... blorpa...', 'eh... spinna...'],
    giggle:   ['hihi-ka! hihihi!', 'no-no-tikki! hihi!'],
    fetch:    ['ooh! nom?', 'nomi? nomi!', 'raddi! raddi!'],
    eat:      ['nom-nom-bapa!', 'mmm, bapa!'],
    stuffed:  ['bapa... full-a.', 'oof. biggo belly.'],
    burp:     ['BUURP!', 'hic! BURP!'],
    sorry:    ['...sorry-a.', 'hehe. pardonne.'],
    full:     ['no-no! full-a!', 'no mo! no mo!', 'nuh-uh. belly full.'],
    flee:     ['eep!', 'eep! bobo!'],
    carry:    ['weee!', 'oh-no-no-no!', 'upsa!'],
    thrown:   ['waaaa!', 'wuuuh-!'],
    land:     ['oof. bapa.', 'ta-da!'],
    sleep:    ['zz... mimi...', 'mimi... zz...'],
    wake:     ['mrrh? ...ah!', 'mm? bwee-lo.'],
    yawn:     ['aaawm...'],
    stretch:  ['nnngh-ah!'],
    read:     ['hmm-hmm... lala-ti...', 'mm... yes... sooo.'],
    inspect:  ['kiki?', 'oo? whatsa?'],
    pet:      ['mrrrr~', 'mmm, bapa~'],
    block:    ['hehe. mine!', 'nope-a! hehe.'],
    shoo:     ['pfft!', 'okay, okay!'],
    flip:     ['wheee!', 'hup-la!', 'ta-daaa!'],
    crooked:  ['oop! wonky.', 'hmm? crooki!', 'uh-oh. tilta.'],
    fixed:    ['dere. fixa.', 'tidy-tidy!', 'ta-da! straighta.'],
    germ:     ['eep! carroto!', 'bad veggie!', 'oi! shoo, carroto!'],
    won:      ['ha! begone!', 'no carroto here.', 'bapa. all clean.'],
    chin:     ['mine-a.', 'mark-a. mine.', 'dis mine now.'],
    eep:      ['eep!', 'EEP. no up!'],
    gimme:    ['gimme! gimme!', 'ooh! filo! filo!', 'catcha!'],
    pack:     ['packa-packa!', 'wrap-wrap!', 'tapo, tapo!'],
    waitfor:  ['where-a?', 'hullo-o? anybodi?', 'tap... tap... tap.'],
    post:     ['deliveri!', 'hup! hup! posto!', 'coming-a!'],
    dropin:   ['plop!', 'in-a go!', 'tikka!'],
    delivered:['ta-da! deliver-o!', 'all dere! bapa!', 'signa here!'],
    lost:     ['uh-oh... gone-a?', 'hullo-o? come back-a...'],
  };
  const THOUGHTS = new Set(['think', 'sleep', 'read', 'inspect', 'yawn', 'babble']);
  const SYL = ['ba', 'po', 'mi', 'lo', 'ki', 'ta', 'nu', 'bee', 'la', 'pi', 'do', 'ka', 'mu', 'tee', 'bo', 'ya'];
  const pick = a => a[Math.random() * a.length | 0];
  const babble = () => {
    const word = () => Array.from({ length: 1 + (Math.random() * 3 | 0) }, () => pick(SYL)).join(Math.random() < 0.3 ? '-' : '');
    return Array.from({ length: 1 + (Math.random() * 3 | 0) }, word).join(' ') + pick(['...', '...', '?', '.']);
  };
  const bubblePop = spring(0);
  let bubble = null, lastSpoke = 0, fontFamily = font || 'serif';
  // chance: how likely it is to bother; force: talk over whatever it was saying
  function say(key, { chance = 1, force = false, text = null } = {}) {
    if (!talk || reducedMotion || Math.random() > chance) return;
    const now = nowS();
    if (!force && now - lastSpoke < 1.1) return;
    text = text ?? (key === 'babble' ? babble() : pick(VOICE[key] || WORDS[key] || WORDS.look));
    bubble = { text, kind: THOUGHTS.has(key) ? 'think' : 'say', since: now, until: now + 1.4 + text.length * 0.055 };
    lastSpoke = now; bubblePop.v = 0.35; bubblePop.vel = 0; bubblePop.t = 1;
  }
  let prevMode = 'home';
  // what it says on walking into a state: [key, chance, force]
  const ON_ENTER = {
    dizzy: ['dizzy', 1, true], giggle: ['giggle', 1, true], flee: ['flee', 1, true],
    carry: ['carry', 1, true], thrown: ['thrown', 1, true], fetch: ['fetch', 0.9],
    sleep: ['sleep', 1], inspect: ['inspect', 0.8], pet: ['pet', 0.6], block: ['block', 1, true],
    catch: ['gimme', 1, true], pack: ['pack', 0.9, true], 'courier-wait': ['waitfor', 0.5], 'courier-stuck': ['lost', 1, true],
  };

  // ── personality: an animal's habits on top of its own ──
  //   pup:   wags its sprout like a tail, tilts its head at you, play-bows and
  //          pounces, gets the zoomies after food or a fuss, follows you keenly
  //   cat:   only sometimes bothers with what you point at, slow-blinks at you,
  //          loafs, grooms, kneads while petted and leaves when it has had
  //          enough, stalks and pounces on a slow pointer, bats its food about
  //   bunny: the sprout is an ear, up when alert and flopped when relaxed; the
  //          nose twitches; it binkies when happy, thumps when startled, flops
  //          over when content, and carries food home before eating it
  const PUP = personality === 'pup', CAT = personality === 'cat', BUN = personality === 'bunny';
  const VOICE = {
    pup:   { hello: ['bwof! bwee-lo!', 'bwof bwof!'], pet: ['hehe! scritchi!', 'mor-a! mor-a!'], cheer: ['bwof! ba-bai!'],
             tilt: ['hm?', 'rrr?'], zoom: ['zoomi-zoomi!', 'WHEEE-hee!'], bow: ['play-a? play-a!'], gotcha: ['gotcha!', 'bwof!'] },
    cat:   { hello: ['mrrp.', '...oh. bwee-lo.'], pet: ['prrrrr~', 'mrrr~'], cheer: ['...ba-bai.'], meh: ['meh.', '...hm.'],
             hmph: ['hmph.', 'enuf.'], bat: ['tap.', 'hehe. tap!'], gotcha: ['mrrp!', 'gotcha.'], look: ['...dat.'] },
    bunny: { hello: ['pip! bwee-lo!', 'bwee-lo! mi mooli.'], pet: ['nnf~', 'pip~'], thump: ['THMP!', 'thmp. eep.'], binky: ['pip-pip!', 'boing!'],
             flop: ['...flop.', 'mm. flop.'], hoard: ['mine-a! hehe.', 'home-a, home-a!'] },
  }[personality] || {};
  const wag = spring(0), ear = spring(1);                  // pup's tail-sprout, bunny's ear-sprout
  let act = null;                                          // { name, since, until, next?, ... }: a habit in progress
  let glance = null, hoarding = null, petBlockUntil = 0;
  let freezeUntil = 0;                                     // a bunny freezes before it thumps and bolts
  let tending = null;                                      // { el, done, since, noticeAt, at, fixed }: something to put straight
  // carrot viruses: they pop out of the page, chew on a word, and get chased off
  // in a cartoon fight cloud. x is a client x, y a page y (they scroll with the page).
  let germs = [], fight = null;                            // germ: { x, y, tx, ty, born, state, ... }
  // courier work: a parcel pops out of one thing on the page onto its head, and
  // it runs it over to another and tosses it in (api.courier)
  let courier = null;                                      // { job, leg: 'fetch' | 'carry', st, since, busyUntil, pending, ending, done }
  let catching = null;                                     // () => rect: something is about to be dropped there
  let packing = null;                                      // { since, lifted }
  let parcel = false, parcelAt = 'head';                   // whether it holds one, and where: on its head or hugged
  let parcels = [];                                        // in flight { x0, y0, x1, y1, since, dur, s0, s1, then } or falling { fall, x, y, vx, vy, rot, spin }
  const chinned = new WeakSet();                           // links a bunny has already marked as its own
  let nextPounceAt = nowS() + 8, nextTiltAt = nowS() + 4, nextSlowBlinkAt = nowS() + 6;
  function startAct(name, dur, data = {}) { act = { name, since: nowS(), until: nowS() + dur, ...data }; }
  function zoom() { startAct('zoomies', 2.6, { cx: p.x + 50, cy: p.y, dir: Math.random() < 0.5 ? -1 : 1 }); say('zoom', { force: true }); }
  function binky() {
    if (flip) return;
    flip = { since: nowS(), dir: Math.random() < 0.5 ? -1 : 1, x: p.x, y: p.y, twist: 0.9, dur: 0.6 };
    jump(230); say('binky', { chance: 0.6, force: true });
  }
  function thump() {
    squash(0.6); jelly(5, 2); S.scared.v = Math.max(S.scared.v, 0.6); say('thump', { force: true });
    later.push({ at: nowS() + 0.22, fn: () => { squash(0.45); jelly(3, 2); } });
  }
  function batRadish(c) {
    c.batted = true; c.flying = true; c.gy = c.y;
    c.vx = (Math.random() < 0.5 ? -1 : 1) * rnd(180, 280); c.vy = -rnd(220, 320);
    S.arms[c.vx > 0 ? 0 : 1][0].vel += c.vx > 0 ? -28 : 28; jelly(2);
    say('bat', { force: true });
  }
  // locomotor play: a few fast laps finished with a binky (EFSA 2020; Rooney et al. 2014)
  function frisky() {
    if (Math.random() < 0.5) { binky(); return; }
    startAct('zoomies', 1.6, { cx: p.x + 40, cy: p.y, dir: Math.random() < 0.5 ? -1 : 1, next: binky });
  }
  function afterMeal() {
    if (PUP && Math.random() < 0.6) zoom();
    else if (BUN) frisky();
    else if (CAT) startAct('groom', 1.8);
  }
  function afterPet() {
    if (PUP && Math.random() < 0.45) zoom();
    else if (BUN && Math.random() < 0.6) frisky();
  }
  // something of its own to do while idle; false to leave it to the shared fidgets
  function idleAct(dp, pd) {
    const r = Math.random();
    if (PUP) {
      if (r < 0.2) { zoom(); return true; }
      if (r < 0.55 && dp) { startAct('headtilt', 1.4, { dir: dp.x > 0 ? 1 : -1 }); say('tilt', { chance: 0.5 }); return true; }
      if (r < 0.8) { startAct('playbow', 1.0); say('bow', { chance: 0.6 }); return true; }
    } else if (CAT) {
      if (r < 0.4) { startAct('loaf', rnd(5, 9)); return true; }
      if (r < 0.75) { startAct('groom', 1.8); return true; }
      if (dp && pd < 260) { startAct('slowblink', 1.5); return true; }
    } else if (BUN) {
      // at ease: loafed with paws tucked, or flopped right over (PDSA; Omlet)
      if (r < 0.2) { startAct('loaf', rnd(5, 9)); return true; }
      if (r < 0.4) { startAct('flop', rnd(4, 7), { dir: Math.random() < 0.5 ? -1 : 1 }); say('flop', { chance: 0.6 }); return true; }
      if (r < 0.5) { startAct('periscope', 1.6); return true; }
      if (r < 0.6) { binky(); return true; }
      if (r < 0.85) { startAct('groom', 1.6); return true; }      // washing its face
    }
    return false;
  }
  // one frame of a habit: sets the pose on tg, returns where to look (or undefined)
  function runAct(a, tg, now, dp) {
    const e = now - a.since, u = e / (a.until - a.since);
    const pounceAt = () => ({ x: ptr.x ?? p.x + rnd(-60, 60), y: ptr.y ?? p.y });
    switch (a.name) {
      case 'zoomies': {                                      // laps of the margin, flat out
        const ang = e * 5.2 * a.dir;
        tg.x = clamp(a.cx + Math.cos(ang) * 80, R + 6, innerWidth - R - 6);
        tg.y = clamp(a.cy + Math.sin(ang) * 110, R + 6, innerHeight - R - 6);
        tg.k = 140; tg.vmax = 950; tg.happy = 1; tg.mouth = 0.35;
        tg.arms = [[-0.9 + 0.3 * Math.sin(e * 20), 1], [PI + 0.9 - 0.3 * Math.sin(e * 20), 1]];
        return { x: -Math.sin(ang) * a.dir, y: Math.cos(ang) * a.dir, abs: true };
      }
      case 'playbow':                                        // front down, bum up, then go
        a.next ??= () => { const t0 = pounceAt(); startAct('pounce', 0.55, t0); };
        tg.k = 40; tg.sy = 0.8; tg.sx = 1.1; tg.lid = 1.1; tg.happy = 0.5;
        tg.arms = [[0.45, 1.05], [PI - 0.45, 1.05]];
        return dp || undefined;
      case 'stalk': {                                        // the bottom wiggle before a pounce
        a.next ??= () => { const t0 = pounceAt(); startAct('pounce', 0.55, t0); };
        const w = Math.sin(e * 24);
        tg.k = 30; tg.sy = 0.84; tg.sx = 1.07 + 0.04 * w; tg.tilt = 0.05 * w; tg.lid = 0.72;
        tg.arms = [[1.3, 0.35], [PI - 1.3, 0.35]];
        return dp || undefined;
      }
      case 'pounce':
        if (!a.launched) { a.launched = true; jump(200); }
        tg.x = clamp(a.x, R + 6, innerWidth - R - 6); tg.y = clamp(a.y, R + 6, innerHeight - R - 6);
        tg.k = 160; tg.vmax = 1100; tg.happy = 0.8; tg.mouth = 0.4;
        tg.arms = [[-0.5, 1.05], [PI + 0.5, 1.05]];
        return { x: a.x - p.x, y: a.y - p.y };
      case 'headtilt':                                       // the "hm?" every dog does
        tg.tilt = 0.32 * a.dir * Math.sin(Math.min(PI / 2, e * 6)); tg.lid = 1.05;
        return { x: 0.25 * a.dir, y: -0.35, abs: true };
      case 'loaf':                                           // paws tucked away, eyes half shut
        tg.sy = 0.86; tg.sx = 1.12; tg.arms = [[1.35, 0.05], [PI - 1.35, 0.05]]; tg.lid = 0.5; tg.happy = 0.2;
        return undefined;
      case 'groom': {                                        // paw to mouth, lick, lick
        const l = Math.abs(Math.sin(e * 11));
        tg.arms = [[2.5 + 0.1 * l, 0.72], [PI - 1.0, 0.5]]; tg.mouth = 0.1 + 0.15 * l; tg.lid = 0.35; tg.tilt = -0.1;
        return { x: 0.4, y: 0.4, abs: true };
      }
      case 'slowblink':                                      // cat for "I like you"
        tg.lid = 1 - 0.96 * Math.sin(PI * clamp(u, 0, 1)); tg.happy = 0.35; tg.k = 20;
        return dp || undefined;
      case 'flop': {                                         // over on its side, content
        const down = Math.min(1, e * 3);
        tg.tilt = 1.2 * a.dir * down; tg.sy = 1 - 0.1 * down; tg.sx = 1 + 0.06 * down; tg.lid = 0.35; tg.happy = 0.5;
        tg.arms = [[1.6, 0.55], [PI - 1.6, 0.55]]; tg.k = 20;
        return null;
      }
      case 'periscope': {                                    // up on its hind legs, scanning
        const up = Math.min(1, e * 5);
        a.y0 ??= p.y;                                        // stand up from where it was, not from where it is
        tg.sy = 1 + 0.24 * up; tg.sx = 1 - 0.13 * up; tg.y = a.y0 - R * 0.18 * up; tg.k = 60;
        tg.arms = [[1.95, 0.45], [PI - 1.95, 0.45]];        // paws held in at the chest
        tg.lid = 1.1;
        return { x: Math.sin(e * 3.4) * 0.9, y: -0.15, abs: true };
      }
      case 'saunter':                                        // tail up, walking off, done with you
        tg.x = a.x; tg.y = a.y; tg.k = 30; tg.vmax = 200; tg.lid = 0.55;
        return { x: Math.sign(a.x - p.x) * 0.6, y: -0.6, abs: true };
    }
    return undefined;
  }

  // What it makes of text you select. The first topic that matches wins, so the
  // specific ones come first; anything else gets its main word echoed back in
  // the creature's accent ("engineer-o?").
  const TOPICS = [
    [/\bmooli\b/i,                                         ['dats mi! mooli!', 'mooli! dats mi name.']],   // its name: Hindi for radish
    [/\b(prateek|gupta)\b/i,                                   ['da boss! bwee-lo!', 'oh! prateeko!']],
    [/digital human|avatar|doppelg|embodied|agent/i,          ['oh! like mi!', 'dats mi! ...kinda.']],
    [/\b(ai|a\.i\.|artificial|robot|machine)\b/i,              ['ai? ...mi cousino!', 'robo-friendos!']],
    [/engineer|software|\bcode|coding|program|developer|three\.js|esp32|\bpin\b|board/i, ['bip-bop! codo!', 'tikka-tikka... compilo!']],
    [/film|cinema|movie|hollywood|screen|kino/i,                ['kino! popcorni?', 'ooh, cinemo!']],
    [/manchester|\buk\b|england|rain/i,                         ['rainy-rainy! bapa.', 'manchesto! brrr.']],
    [/snake|nagmani|\bgame/i,                                   ['sssnek! play-a?']],
    [/song|music|soundcloud|monsoon/i,                         ['la-la-pum!', 'musica! bapa!']],
    [/chat|message|p2p|server/i,                               ['tikka, takka!', 'psst! messago!']],
    [/gesture|hands?\b|wave|wav/i,                              ['like dis?', 'hands! wiggle-wiggle!']],
    [/history|evolution|19\d\d|20\d\d|\bpast\b/i,              ['ooold. sooo old.', 'looong time-o!']],
    [/dataset|\bdata\b|\d[\d,]{2,}/i,                           ['sooo many! lotsa!', 'numbos! ooh.']],
    [/think|thought|mind|cogito|canvas/i,                      ['hmmm... cogito?']],
    [/small|tiny|little|mini/i,                                ['teeny-tiki! like mi!']],
    [/media|practitioner|artist|future/i,                      ['ooh, arty-farty!', 'futuro! bapa!']],
    [/writ|article|read/i,                                     ['wordos! bapa.']],
  ];
  const STOP = new Set('the and for with that this from have about which what were your into they their there them just than then also mostly'.split(' '));
  function reactTo(text) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    let line;
    if (t.length > 160) line = pick(['sooo looong... mimi.', 'wordos, wordos, wordos!']);
    else {
      const hit = TOPICS.find(([re]) => re.test(t));
      if (hit) line = pick(hit[1]);
      else if (/\?\s*$/.test(t)) line = 'hmm... dunno-ka?';
      else {
        const words = (t.toLowerCase().match(/[a-z\u00c0-\u024f]{4,}/g) || []).filter(w => !STOP.has(w));
        const w = words.sort((a, b) => b.length - a.length)[0];
        line = w ? pick([`${w}-o?`, `hmm... ${w}-a!`, `${w}? bapa!`]) : pick(['hmm?', 'oo? whatsa?']);
      }
    }
    say('look', { force: true, text: line });
    jump(90); jelly(2);
  }

  // ── impulses ──
  const jelly = (amp, mode = 2) => { for (let i = 0; i < N; i++) wobV[i] += amp * Math.cos(i * mode * TAU / N + Math.random()); };
  // squash impulses are capped, so a flurry of them can't pile up into a pancake
  const squash = a => { S.sy.vel = clamp(S.sy.vel - a * 6, -7, 7); S.sx.vel = clamp(S.sx.vel + a * 4, -5, 5); };
  // anticipation: a crouch, then the launch a beat later, stretching as it goes
  const jump = a => {
    squash(0.2 * a / 100);
    later.push({ at: nowS() + 0.07, fn: () => { v.y -= a; S.sy.vel += a * 0.014; S.sx.vel -= a * 0.008; } });
  };
  const touch = () => { lastActivity = nowS(); if (asleep) wake(); };
  // a double-click trick: one clean flip in the air, eased in and out, then a
  // squashy landing. Its own angle, so it never fights the tilt spring.
  const FLIP_TIME = 0.62;
  let flip = null;                                         // { since, dir }
  const flipAngle = now => {
    if (!flip) return 0;
    const u = clamp((now - flip.since) / (flip.dur || FLIP_TIME), 0, 1);
    if (flip.twist) return flip.dir * flip.twist * Math.sin(PI * u);   // a binky: twist and back
    return flip.dir * TAU * (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  };
  function wake() {
    asleep = false; S.lid.t = 1; S.lid.vel += 20; squash(-0.3); jelly(3);
    say('wake', { chance: 0.8, force: true });
    fidget = { name: 'stretch', since: nowS(), until: nowS() + 1.4 };
  }
  const reach = (dx, dy) => {
    let a = Math.atan2(dy, dx);
    if (dx >= 0) return [[clamp(a, -1.45, 1.45), 1.05], null];
    if (a < 0) a += TAU;
    return [null, [clamp(a, PI - 1.45, PI + 1.45), 1.05]];
  };

  // ── gestures: c is { dx, dy } toward the thing and c.t seconds since it started ──
  const G = {
    point: c => ({ arms: reach(c.dx, c.dy) }),
    snake: c => {
      const arms = reach(c.dx, c.dy), i = arms[0] ? 0 : 1;
      arms[i][0] += 0.28 * Math.sin(c.t * 6); arms[i][1] = 1 + 0.12 * Math.sin(c.t * 6 + 1);
      return { arms, tilt: 0.05 * Math.sin(c.t * 6), look: [c.dx, c.dy] };
    },
    frame: () => ({ arms: [[-1.05, 1.05], [PI + 1.05, 1.05]], look: [0, -0.5] }),
    tpose: () => ({ arms: [[0, 1.1], [PI, 1.1]], look: [0, 0], sx: 1.04 }),
    think: c => ({ arms: [[-2.35, 0.55], [PI - 0.7, 0.45]], look: [0.55, -0.85], tilt: 0.16 + 0.03 * Math.sin(c.t * 0.9), lid: 0.8 }),
    exchange: c => {
      const a = Math.max(0, Math.sin(c.t * 4)), b = Math.max(0, Math.sin(c.t * 4 + PI));
      const ang = Math.atan2(c.dy, c.dx), right = c.dx >= 0;
      const ra = right ? clamp(ang, -1.3, 1.3) : 0.3, la = right ? PI - 0.3 : clamp(ang < 0 ? ang + TAU : ang, PI - 1.3, PI + 1.3);
      return { arms: [[ra, 0.4 + 0.7 * a], [la, 0.4 + 0.7 * b]], happy: 0.3 };
    },
    wave: c => ({ arms: [[-1.35 + 0.45 * Math.sin(c.t * 10), 1.05], null], happy: 0.7 }),
    conduct: c => {
      const b = Math.sin(c.t * TAU * 1.4);
      return { arms: [[-1.1 + 0.45 * b, 0.95], [PI + 1.1 - 0.45 * b, 0.95]], beat: 1.4, look: [0, -0.3] };
    },
    big: () => ({ sc: 1.28, arms: [[-0.35, 1.1], [PI + 0.35, 1.1]], look: [0, -0.4], mouth: 0.35 }),
    small: () => ({ sc: 0.78, arms: [[1.2, 0.25], [PI - 1.2, 0.25]], lid: 0.55, look: [0, 0.3] }),
    stretch: c => { const u = Math.sin(Math.min(PI, c.t * 2.2)); return { sy: 1 + 0.1 * u, sx: 1 - 0.04 * u, lid: 1 - 0.75 * u, arms: [[-1.5 * u + 0.85 * (1 - u), 0.5 + 0.55 * u], [PI + 1.5 * u - 0.85 * (1 - u), 0.5 + 0.55 * u]] }; },
    yawn: c => { const u = Math.sin(Math.min(PI, c.t * 2.6)); return { mouth: 0.9 * u, lid: 1 - 0.85 * u, sc: 1 + 0.05 * u, arms: [[-1.6, 0.5 * u + 0.3], [PI - 0.85, 0.5]] }; },
    shiver: () => ({ jelly: 1, lid: 0.6, sc: 0.96, arms: [[1.3, 0.3], [PI - 1.3, 0.3]] }),
    bow: c => { const u = Math.sin(Math.min(PI, c.t * 2.6)); return { sy: 1 - 0.18 * u, look: [0, 0.9 * u], arms: [[0.95, 0.7], [PI - 0.95, 0.7]], lid: 1 - 0.5 * u }; },
  };

  // ───────────────────────────── deciding ─────────────────────────────
  function think(now, dt) {
    const tg = { x: p.x, y: p.y, k: 30, vmax: 260, arms: [[REST_ARMS[0][0] + 0.06 * Math.sin(t * 1.3), REST_ARMS[0][1]], [REST_ARMS[1][0] - 0.06 * Math.sin(t * 1.3 + 1), REST_ARMS[1][1]]],
      sx: 1, sy: 1, sc: 1, tilt: 0, lid: 1, happy: 0, scared: 0, mouth: 0, look: null };
    // breathing: a quicker in, a slower out, and it keeps its volume while it does
    const ph = t * 1.6, breath = Math.sin(ph + 0.45 * Math.sin(ph));
    tg.sy += 0.02 * breath; tg.sx -= 0.009 * breath;
    if (night) tg.lid = 0.85;
    const home = { x: MARGIN, y: clamp(ptr.y ?? innerHeight * 0.4, R + 12, innerHeight - R - 12) };
    const dp = ptr.x != null ? { x: ptr.x - p.x, y: ptr.y - p.y } : null;
    const pd = dp ? Math.hypot(dp.x, dp.y) : 1e9;
    const pspeed = Math.hypot(ptr.vx, ptr.vy);
    const pointerIdle = ptr.x != null ? now - ptr.moved : 0;
    let look = dp ? { x: dp.x, y: dp.y } : null;
    // the pointer just left the window: keep an eye on where it went
    if (!dp && exit && now - exit.t < 4) look = { x: exit.x - p.x, y: exit.y - p.y };
    let mode = 'home';
    let foe = null, cr = null, cw = null;
    parcelAt = 'head';

    if (tending && !tending.fixed && (now - tending.since > 10 || !tending.el.isConnected)) { tending.fixed = true; tending.done(); tending = null; }

    // a reflex that interrupts anything: something is rushing at it
    if (!carried && dp && pspeed > 1300 && pd < 260 && now > fleeUntil && (dp.x * ptr.vx + dp.y * ptr.vy) < -0.5 * pd * pspeed) {
      fleeUntil = now + 0.9; waryUntil = now + 4;
      const ax = -dp.x / pd, ay = -dp.y / pd;
      fleeTo = { x: clamp(p.x + ax * 240 + rnd(-40, 40), R + 8, innerWidth - R - 8), y: clamp(p.y + ay * 240 + rnd(-40, 40), R + 8, innerHeight - R - 8) };
      S.scared.v = 1; jelly(6, 3); touch();
      attended = null; inspect = null; block = null; act = null;
      // rabbits freeze first, thump to warn, then bolt (Rabbit Basic Science; dvm360)
      if (BUN) { freezeUntil = now + 0.45; fleeUntil += 0.45; later.push({ at: now + 0.45, fn: thump }); }
    }

    if (flip) {
      mode = 'flip';
      tg.x = flip.x; tg.y = flip.y; tg.k = 70; tg.vmax = 1e9;
      tg.happy = 1; tg.arms = [[-1.25, 1], [PI + 1.25, 1]]; tg.mouth = 0.3;
      look = null;
    } else if (carried) {
      mode = 'carry';
      tg.x = ptr.x - carried.dx; tg.y = ptr.y - carried.dy; tg.k = 900; tg.vmax = 1e9;
      tg.sy = 1.06; tg.lid = 1.1; tg.mouth = 0.3;
      tg.arms = [[1.35, 0.8], [PI - 1.35, 0.8]];
      look = { x: 0, y: -1 };
      // a rabbit held too long goes rigid and still: tonic immobility, which is
      // fear, not calm (Trocino et al. 2013). Stiff limbs, wide unblinking eyes.
      if (BUN && nowS() - carried.at > 1.1) {
        mode = 'trance';
        tg.mouth = 0; tg.lid = 1.15; tg.sy = 1.02; tg.scared = 0.9;
        tg.arms = [[0.75, 1.0], [PI - 0.75, 1.0]];
        look = { x: 0, y: 0, abs: true };
        nextBlinkAt = Math.max(nextBlinkAt, now + 0.5);
      }
    } else if (now < thrownUntil) {
      mode = 'thrown'; tg.k = 0; tg.vmax = 1e9; tg.lid = 1.1; tg.mouth = 0.5; look = { x: v.x, y: v.y };
      tg.arms = [[-1.2, 1], [PI + 1.2, 1]];
    } else if (now < freezeUntil) {
      // frozen: perfectly still, eyes wide, ears up and listening
      mode = 'freeze';
      tg.k = 300; tg.vmax = 40; tg.scared = 0.7; tg.lid = 1.15; tg.sy = 0.94;
      tg.arms = [[1.45, 0.3], [PI - 1.45, 0.3]];
      look = { x: dp ? Math.sign(dp.x) * 0.5 : 0, y: 0, abs: true };
    } else if (now < fleeUntil) {
      mode = 'flee'; tg.x = fleeTo.x; tg.y = fleeTo.y; tg.k = 140; tg.vmax = 900;
      tg.scared = 1; tg.sc = 0.92; tg.mouth = 0.4;
      tg.arms = [[-1.25 + 0.2 * Math.sin(now * 30), 1], [PI + 1.25 - 0.2 * Math.sin(now * 30), 1]];
    } else if (now < dizzyUntil) {
      // you spun it round: it staggers about on the spot, eyes spinning
      mode = 'dizzy';
      const u = clamp((dizzyUntil - now) / 2.8, 0, 1);
      tg.tilt = 0.26 * u * Math.sin(now * 4.6); tg.k = 16; tg.vmax = 120;
      tg.x = p.x + 9 * u * Math.sin(now * 2.3); tg.y = p.y + 3 * Math.sin(now * 4.6);
      tg.mouth = 0.18; tg.sy = 1 - 0.05 * u;
      tg.arms = [[0.4 + 0.5 * Math.sin(now * 3.1), 0.85], [PI - 0.4 + 0.5 * Math.sin(now * 3.1 + 1.4), 0.85]];
      look = null;
    } else if (now < giggleUntil) {
      // tickled: it can't keep still
      mode = 'giggle';
      tg.happy = 1; tg.lid = 0.3; tg.k = 40;
      tg.mouth = 0.3 + 0.3 * Math.abs(Math.sin(now * 17));
      tg.tilt = 0.13 * Math.sin(now * 21); tg.sy = 1 + 0.05 * Math.sin(now * 17);
      tg.arms = [[-0.5 + 0.35 * Math.sin(now * 15), 0.85], [PI + 0.5 - 0.35 * Math.sin(now * 15 + 1), 0.85]];
      for (let i = 0; i < N; i++) wobV[i] += 0.35 * Math.sin(now * 37 + i * 2);
      look = null;
    } else if (eating) {
      // a meal in four beats: grab it, three chomps with it held up to the
      // mouth, a gulp, and a pat on the belly
      mode = 'eat';
      const age = now - eating.since;
      tg.k = 60; look = { x: 0, y: 0.5, abs: true };
      if (age < 0.3) {
        tg.sy = 0.88; tg.sx = 1.05; tg.mouth = 0.7; tg.lid = 1.08;
        tg.arms = [[1.25, 1.05], [PI - 1.25, 1.05]];               // down to the radish
      } else if (age < 1.5) {
        const k = (age - 0.3) / 1.2, bite = Math.min(2, Math.floor(k * 3));
        if (bite !== eating.bites) { eating.bites = bite; chomp(); }
        const ch = Math.abs(Math.sin(k * 3 * PI));                   // one chew per bite
        tg.mouth = 0.12 + 0.55 * ch; tg.lid = 0.55 + 0.35 * (1 - ch); tg.happy = 0.35;
        tg.sy = 1 - 0.04 * ch; tg.sx = 1 + 0.03 * ch;
        tg.arms = [[2.16, 0.62], [PI - 2.16, 0.62]];                // a hand either side of it, under the chin
        puff.t = 1;
      } else if (age < 1.85) {
        if (!eating.gulped) { eating.gulped = true; gulp(); }
        tg.mouth = 0; tg.happy = 1; tg.sy = 0.9; tg.sx = 1.06;
        tg.arms = [[1.05, 0.5], [PI - 1.05, 0.5]];
      } else if (age < 2.7) {
        const pat = Math.sin((age - 1.85) * 15);
        tg.happy = 1; tg.lid = 0.6;
        tg.arms = [[2.3 + 0.18 * pat, 0.72], [PI - 0.95, 0.5]];       // pat, pat
        if (pat > 0.95 && !eating.patting) { eating.patting = true; for (let i = 8; i < 13; i++) wobV[i] += 1.2; }
        if (pat < 0) eating.patting = false;
      } else { eating = null; afterMeal(); }
    } else if (packing) {
      // wrapping it up, round and round, then up onto its head
      mode = 'pack';
      const e = now - packing.since;
      tg.k = 60;
      if (e < 0.95) {
        parcelAt = 'chest';
        const w = Math.sin(e * 16);
        tg.arms = [[2.16 + 0.18 * w, 0.62], [PI - 2.16 + 0.18 * w, 0.62]];
        tg.sy = 0.92 + 0.03 * w; tg.lid = 0.7; tg.happy = 0.6; tg.mouth = 0.1;
        look = { x: 0, y: 0.7, abs: true };
      } else {
        if (!packing.lifted) { packing.lifted = true; jump(140); jelly(2); }
        tg.arms = [[-1.3, 1.05], [PI + 1.3, 1.05]]; tg.happy = 1;
        look = { x: 0, y: -0.6, abs: true };
        if (e > 1.35) packing = null;
      }
    } else if (catching && (cr = catching())) {
      // something is coming: under it, arms up, bouncing on the spot
      mode = 'catch';
      tg.x = clamp(cr.left + cr.width / 2, R + 6, innerWidth - R - 6); tg.y = clamp(cr.bottom - R * 1.3, R + 6, innerHeight - R - 6);
      tg.k = 90; tg.vmax = 700; tg.happy = 1; tg.mouth = 0.35; tg.sy = 1.06;
      const w = Math.sin(now * 9);
      tg.arms = [[-1.0 + 0.25 * w, 1.05], [PI + 1.0 - 0.25 * w, 1.05]];
      if (Math.floor(now * 2.2) !== Math.floor((now - dt) * 2.2)) jump(70);
      look = { x: 0, y: -1, abs: true };
    } else if (courier && (cw = runCourier(tg, now, dt))) {
      mode = cw.mode; look = cw.look;
    } else if (fight || (foe = germs.find(g => (g.state === 'walk' || g.state === 'nibble') && now - g.born > 0.6))) {
      mode = 'fight';
      if (fight) {
        // inside the cloud: hold still, the cloud does the acting
        tg.x = fight.x; tg.y = fight.y; tg.k = 300; tg.vmax = 1e9; look = null;
        if (now > fight.until) {
          const g = fight.germ, dir = Math.random() < 0.5 ? -1 : 1;
          Object.assign(g, { state: 'launched', launchedAt: now, x: fight.x, y: fight.y + scrollY, vx: dir * rnd(220, 320), vy: -rnd(420, 520), spin: dir * rnd(10, 16) });
          for (let i = 0; i < 12; i++) bits.push({ x: fight.x + rnd(-R, R), y: fight.y + rnd(-R, R), vx: rnd(-170, 170), vy: rnd(-220, -40), t: now, col: i % 3 ? ink : '#F28C28', r: rnd(1, 2.4) });
          fight = null; S.happy.v = 1; jump(160); jelly(4); say('won', { force: true });
        }
      } else {
        // spotted one: narrow eyes, fists up, charge
        const gx = foe.x, gy = foe.y - scrollY;
        if (!foe.spotted) { foe.spotted = true; say('germ', { force: true }); }
        tg.x = gx - R * 0.8 * (Math.sign(gx - p.x) || 1); tg.y = gy; tg.k = 120; tg.vmax = 900;
        tg.lid = 0.72; tg.mouth = 0.25; tg.arms = [[-0.3, 1.05], [PI + 0.3, 1.05]];
        look = { x: gx - p.x, y: gy - p.y };
        if (Math.hypot(gx - p.x, gy - p.y) < R * 1.5) {
          fight = { x: (gx + p.x) / 2, y: (gy + p.y) / 2, since: now, until: now + 1.5, germ: foe };
          foe.state = 'fighting';
        }
      }
    } else if (hoarding) {
      // a bunny takes its food home to eat it: held up over its head, hop hop
      mode = 'hoard';
      tg.x = MARGIN; tg.y = hoarding.homeY; tg.k = 60; tg.vmax = 420; tg.happy = 0.7;
      tg.arms = [[-1.15, 0.75], [PI + 1.15, 0.75]];
      look = { x: tg.x - p.x, y: 0 };
      if (Math.hypot(tg.x - p.x, tg.y - p.y) < R * 0.8) {
        hoarding.x = p.x; hoarding.y = p.y + scrollY; hoarding.hoarded = true;
        eating = { crumb: hoarding, since: now, bites: -1, gulped: false };
        hoarding = null;
      }
    } else if (refuse && now < refuse.until) {
      // offered food while full: head shaking, hands up
      mode = 'refuse';
      const sh = Math.sin(now * 15);
      tg.tilt = 0.07 * sh; tg.mouth = 0.14; tg.lid = 0.8; tg.k = 40;
      tg.arms = [[-0.55, 0.85], [PI + 0.55, 0.85]];
      look = { x: 0.85 * sh, y: 0.1, abs: true };
    } else if (crumbs.some(c => !c.refused) && full >= FULL && !attended) {
      for (const c of crumbs) c.refused = true;
      refuse = { until: now + 1.6 };
      say('full', { force: true });
    // it eats until full; radishes it turned down wait until it has digested a bit
    } else if (crumbs.length && full < FULL && (crumbs.some(c => !c.refused) || full < FULL * 0.7) && !attended && now > waryUntil) {
      mode = 'fetch';
      const c = nearestCrumb();
      tg.x = c.x; tg.y = c.y - scrollY; tg.k = 70; tg.vmax = 520; tg.happy = 0.4;
      look = { x: tg.x - p.x, y: tg.y - p.y };
      tg.arms = [[-0.6, 0.9], [PI + 0.6, 0.9]];
      if (!c.flying && Math.hypot(tg.x - p.x, tg.y - p.y) < R * 0.7) {
        if (BUN && !c.hoarded && Math.abs(c.x - MARGIN) > 60) { hoarding = c; c.homeY = home.y; say('hoard', { chance: 0.7 }); }
        else if (CAT && !c.batted && Math.random() < 0.4) batRadish(c);
        else eating = { crumb: c, since: now, bites: -1, gulped: false };
      }
    } else if (attended && attended.el.isConnected) {
      mode = 'attend';
      let lookSet = false;
      const r = attended.el.getBoundingClientRect();
      const blockEl = attended.el.closest('p, li, h1, h2, h3, h4, dd, dt, td, div, section') || attended.el.parentElement;
      const atStart = r.left - blockEl.getBoundingClientRect().left < 24;   // the link starts its line
      let tx, ty;
      if (atStart) { tx = r.left - 2; ty = r.top + r.height / 2; }
      else { tx = r.left + r.width / 2; ty = r.top + 1; }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
      const g = (G[attended.gesture] || G.point)({ dx: dx / d, dy: dy / d, t: now - attended.since });
      merge(tg, g);
      const span = R * (1.1 + 1.25 * (g.sc || 1));
      if (atStart) { tg.x = Math.max(R + 4, tx - span); tg.y = ty + 2; }      // stand just left of it
      else { tg.x = tx; tg.y = r.top - R * 1.55 * (g.sc || 1); }             // mid-line: perch above, point down
      tg.k = 90; tg.vmax = 700;
      if (g.beat && Math.floor((now - attended.since) * g.beat) !== Math.floor((now - dt - attended.since) * g.beat)) jump(90);
      // rabbits chin-mark novel objects (Martinez-Gomez et al. 1997; and on novelty, 2010):
      // a new link gets its chin rubbed on it, once, after the gesture has landed
      const age = now - attended.since;
      if (BUN && !chinned.has(attended.el) && age > 0.7) {
        if (age < 1.6) {
          tg.tilt = 0.14 * Math.sin(age * 18); tg.sy = 0.9; tg.lid = 0.6; tg.happy = 0.4;
          look = { x: 0, y: 0.8, abs: true };
          if (!attended.chinSaid) { attended.chinSaid = true; say('chin', { chance: 0.6, force: true }); }
          lookSet = true;
        } else chinned.add(attended.el);
      }
      if (!lookSet) look = g.look ? { x: g.look[0], y: g.look[1], abs: true } : { x: dx, y: dy };
    } else if (tending && now > tending.noticeAt) {
      mode = 'tend';
      const r = tending.el.getBoundingClientRect();
      // like pointing: beside it if it starts its line, perched just above it if it sits mid-line
      const line = tending.el.closest('p, li, h1, h2, h3, h4, dd, dt, td, div, section') || tending.el.parentElement;
      if (r.left - line.getBoundingClientRect().left < 24) { tg.x = Math.max(R + 4, r.left - R * 1.9); tg.y = r.top + r.height * 0.5 + 2; }
      else { tg.x = r.left + r.width * 0.5; tg.y = r.top - R * 1.55; }
      tg.k = 90; tg.vmax = 650;
      const dx = r.left + r.width * 0.5 - p.x, dy = r.top + r.height * 0.4 - p.y, d = Math.hypot(dx, dy) || 1;
      look = { x: dx, y: dy };
      if (!tending.said) { tending.said = true; say('crooked', { force: true }); }
      if (!tending.at && Math.hypot(tg.x - p.x, tg.y - p.y) < R * 0.9) tending.at = now;
      if (tending.at) {
        const e = now - tending.at, nudge = Math.max(0, Math.sin(e * 9));
        const a = reach(dx / d, dy / d), i = a[0] ? 0 : 1;
        a[i][1] = 0.75 + 0.35 * nudge; tg.arms[i] = a[i];          // reach out, nudge, nudge
        tg.sy = 1 - 0.05 * nudge; tg.lid = 0.85; tg.mouth = 0.15;
        if (e > 0.75 && !tending.fixed) { tending.fixed = true; tending.done(); jelly(2); S.happy.v = 1; say('fixed', { force: true }); }
        if (e > 1.6) { tending = null; afterAttend = now + 1; }
      }
    } else if (reading && now - reading.since > 0.35 && reading.rect()?.width) {
      // you selected some text: it comes and reads it with you, eyes running
      // along the line and snapping back, a little nod at each new line
      mode = 'read';
      // it stands in the gutter beside the paragraph, level with the line, so it
      // never covers what it reads (gutter: the block's left edge, if rect gives one)
      const r = reading.rect(), edge = r.gutter ?? r.left;
      tg.x = clamp(edge - R * 2.3, R + 4, innerWidth - R - 4); tg.y = r.top + Math.min(r.height, 36) / 2 + 2;
      tg.k = 60; tg.vmax = 500; tg.lid = 0.82; tg.tilt = 0.07;
      tg.arms = [[-0.35, 0.6], [PI + 0.35, 0.6]];
      const sweep = (now - reading.since) * 0.75, line = Math.floor(sweep);
      if (line !== reading.line) { reading.line = line; S.sy.vel -= 1.6; }
      // say something about it once you have stopped dragging
      if (!reading.reacted && now - reading.changedAt > 0.5 && now - reading.since > 0.6) { reading.reacted = true; reactTo(reading.text); }
      look = { x: -0.15 + 1.05 * (sweep - line), y: 0.3, abs: true };
    } else if (block && now < block.until && block.el.isConnected) {
      mode = 'block';
      const r = block.el.getBoundingClientRect();
      tg.x = r.left + r.width * 0.5; tg.y = r.top + r.height * 0.5 - 2; tg.k = 120; tg.vmax = 900;
      tg.happy = 0.6; tg.sy = 0.94;
      tg.arms = [[0.2, 0.9], [PI - 0.2, 0.9]];
      if (pd < 48) shoo();
    } else if (ptr.over && dp && pspeed < 400 && now - ptr.overSince > 0.25 && !asleep && now > petBlockUntil) {
      mode = 'pet';
      tg.happy = 1; tg.lid = 0.3; tg.k = 50;
      tg.x = p.x + dp.x * 0.12; tg.y = p.y + dp.y * 0.12;
      tg.arms = [[0.4 + 0.1 * Math.sin(now * 6), 0.7], [PI - 0.4 - 0.1 * Math.sin(now * 6), 0.7]];
      if (CAT) {
        // kneading, paw then paw, and a purr you can almost see
        tg.arms = [[1.0 + 0.35 * Math.max(0, Math.sin(now * 7)), 0.6], [PI - 1.0 - 0.35 * Math.max(0, Math.sin(now * 7 + PI)), 0.6]];
        for (let i = 0; i < N; i++) wobV[i] += 0.12 * Math.sin(now * 55 + i);
        if (now - ptr.overSince > 3.2) {
          petBlockUntil = now + 4;
          startAct('saunter', 1.8, { x: clamp(p.x + (p.x < innerWidth / 2 ? 150 : -150), R + 6, innerWidth - R - 6), y: p.y });
          say('hmph', { force: true });
        }
      }
      if (pspeed > 60) { for (let i = 0; i < N; i++) wobV[i] += 0.5 * Math.sin(now * 40 + i); }
      look = null; afterAttend = now + 1.2;
    } else if (act && now < act.until) {
      mode = act.name;
      const lk = runAct(act, tg, now, dp);
      if (lk !== undefined) look = lk;
    } else if (asleep) {
      mode = 'sleep';
      tg.x = home.x; tg.y = p.y; tg.k = 10; tg.lid = 0.04; tg.sy = 0.9 + 0.03 * Math.sin(now * 1.9); tg.sx = 1.06;
      tg.arms = [[1.25, 0.35], [PI - 1.25, 0.35]];
      look = null;
      if (now > nextZ) { zs.push({ x: p.x + R * 0.9, y: p.y - R, t: now }); nextZ = now + rnd(1.3, 2.2); }
    } else if (inspect && now < inspect.until) {
      mode = 'inspect';
      const side = inspect.x > innerWidth * 0.5 ? -1 : 1;
      tg.x = inspect.x - side * 62; tg.y = inspect.y + 12; tg.k = 40; tg.vmax = 300;
      const here = Math.hypot(tg.x - p.x, tg.y - p.y) < 10;
      if (here && !inspect.poked && now - inspect.since > 1.6) inspect.poked = now;
      if (inspect.poked && now - inspect.poked < 0.9) { const u = Math.sin((now - inspect.poked) / 0.9 * PI); const a = reach(side, 0.1); const i = a[0] ? 0 : 1; a[i][1] *= u; tg.arms[i] = a[i]; tg.lid = 0.75; }
      if (inspect.poked && now - inspect.poked > 1.2) tg.tilt = side * 0.12;
    } else {
      if (dp && !CAT && ptr.x < MARGIN + (PUP ? 320 : 70) && now > waryUntil) {
        mode = 'follow';
        tg.x = ptr.x - 34; tg.y = ptr.y + 28; tg.k = PUP ? 30 : 22; tg.vmax = PUP ? 540 : 420; tg.happy = PUP ? 0.7 : 0.3;
      } else {
        tg.x = home.x; tg.y = home.y; tg.k = now > waryUntil ? 14 : 30; tg.vmax = 260;
        if (now < waryUntil && pd < 130) { tg.x = p.x - dp.x / pd * 90; tg.y = p.y - dp.y / pd * 90; tg.scared = 0.4; }
      }
      if (!fidget && now > nextFidgetAt && pd > 90) {
        const r = Math.random();
        if (personality && Math.random() < 0.6 && idleAct(dp, pd)) { /* one of its own habits */ }
        else if (night && r < 0.3) { fidget = { name: 'yawn', since: now, until: now + 1.3 }; say('yawn'); }
        else if (r < 0.4) { wander = { x: rnd(0, innerWidth), y: rnd(0, innerHeight) }; wanderUntil = now + rnd(0.8, 2); }
        else if (r < 0.58) { fidget = { name: 'stretch', since: now, until: now + 1.5 }; say('stretch', { chance: 0.5 }); }
        else if (r < 0.72) { fidget = { name: 'yawn', since: now, until: now + 1.3 }; say('yawn', { chance: 0.7 }); }
        else if (r < 0.84) jump(140);
        else if (r < 0.92) fidget = { name: 'shiver', since: now, until: now + 0.5 };
        else say('babble');            // just thinking out loud
        nextFidgetAt = now + rnd(4, 9);
      }
      if ((PUP || CAT) && dp && pd > 120 && pd < 380 && pspeed > 30 && pspeed < 420 && now > nextPounceAt && mode === 'home') {
        startAct(PUP ? 'playbow' : 'stalk', PUP ? 1.0 : 1.2); nextPounceAt = now + rnd(14, 28);
        if (PUP) say('bow', { chance: 0.6 });
      } else if (PUP && dp && pointerIdle > 0.45 && pointerIdle < 0.6 && pd < 300 && now > nextTiltAt) {
        startAct('headtilt', 1.4, { dir: dp.x > 0 ? 1 : -1 }); nextTiltAt = now + rnd(6, 14); say('tilt', { chance: 0.5 });
      } else if (CAT && dp && pointerIdle > 1.2 && pd < 220 && now > nextSlowBlinkAt) {
        startAct('slowblink', 1.5); nextSlowBlinkAt = now + rnd(12, 22);
      }
      if (dp && pointerIdle > 3 && pd > 110 && !inspect && now > waryUntil && now > nextInspectAt && mode === 'home') {
        inspect = { x: ptr.x, y: ptr.y, since: now, until: now + 7, poked: 0 };
        nextInspectAt = now + rnd(25, 45);
      }
      if (mischief && dp && !block && now > nextBlockAt && pspeed > 140 && pspeed < 650 && mode === 'home') {
        const el = linkAhead();
        if (el) { block = { el, until: now + 4.5, shooed: false }; nextBlockAt = now + (CAT ? rnd(15, 35) : rnd(45, 90)); }
      }
      if (now - lastActivity > sleepAfter * 0.5) { tg.sy = 0.95; tg.lid = 0.6; }
      if (now - lastActivity > sleepAfter && !asleep) { asleep = true; nextZ = now + 0.8; }
    }
    if (inspect && (now >= inspect.until || (dp && pointerIdle < 0.2 && pd < 50))) inspect = null;
    if (inspect && pointerIdle < 0.3 && mode === 'inspect') inspect.until = Math.min(inspect.until, now + 1.2);
    if (block && now >= block.until) block = null;

    if (fidget) {
      if (now > fidget.until || mode !== 'home' && mode !== 'follow' && mode !== 'sleep') fidget = null;
      else { const g = G[fidget.name]({ t: now - fidget.since }); merge(tg, g); if (g.jelly) jelly(0.8); }
    }

    if (act) {
      if (now >= act.until) { const next = act.next; act = null; if (next) next(); }
      else if (mode !== act.name) act = null;
    }
    if (glance && now < glance.until && (mode === 'home' || mode === 'loaf') && glance.el.isConnected) {
      const r = glance.el.getBoundingClientRect();
      look = { x: r.left - p.x, y: r.top + r.height / 2 - p.y };
    }
    if (now < wanderUntil && (mode === 'home' || mode === 'follow')) look = { x: wander.x - p.x, y: wander.y - p.y };
    if (now < afterAttend && mode === 'home' && dp) look = dp;
    if (look) {
      if (look.abs) tg.look = [look.x, look.y];
      else { const d = Math.hypot(look.x, look.y) || 1; tg.look = [look.x / d, look.y / d * 0.8]; }
    } else tg.look = [0, 0];

    // eyes lead and the body follows: unless something set its tilt, it leans a
    // touch toward what it is looking at, on the tilt spring's slower time
    if (tg.tilt === 0 && mode !== 'sleep') tg.tilt = 0.07 * tg.look[0];

    // saccades: every so often the eyes jump to a slightly different spot and hold
    if (now > nextSaccadeAt) {
      const amp = mode === 'attend' || mode === 'read' ? 0.07 : mode === 'sleep' || mode === 'dizzy' ? 0 : 0.24;
      sac[0].t = rnd(-amp, amp); sac[1].t = rnd(-amp, amp) * 0.6;
      nextSaccadeAt = now + (Math.random() < 0.25 ? rnd(0.12, 0.3) : rnd(0.5, 2.6));
    }

    // it faces the way it is going, or the way it is looking when it stands still
    const going = Math.abs(v.x) > 60 && mode !== 'carry' && mode !== 'thrown';
    face.t = mode === 'sleep' ? 0 : going ? clamp(v.x / 280, -1, 1) * 0.9 : tg.look[0] * 0.45;

    // a full belly: heavier breathing, heavier lids
    const b = clamp(belly.v, 0, 1.3);
    if (b > 0.05 && mode !== 'eat') {
      tg.sy += 0.015 * b * Math.sin(t * 1.3);
      if (b > 0.75 && (mode === 'home' || mode === 'follow')) tg.lid = Math.min(tg.lid, 0.72);
    }
    if (mode !== 'eat') puff.t = 0;
    if (PUP) wag.t = ['pet', 'eat', 'attend', 'fetch', 'zoomies', 'playbow', 'pounce', 'follow'].includes(mode) ? 1 : tg.happy > 0.3 ? 0.7 : pd < 150 ? 0.45 : 0.08;
    if (BUN) {
      // ears: up when alert, flopped when relaxed, pinned flat when afraid
      // (flattened ears and a crouch read as fear: RSPCA; Rabbit Grimace Scale)
      const afraid = ['flee', 'carry', 'trance', 'thrown'].includes(mode);
      const alert = ['attend', 'read', 'fetch', 'hoard', 'inspect', 'freeze', 'periscope'].includes(mode) || pd < 150;
      const easy = ['flop', 'sleep', 'pet', 'loaf'].includes(mode) || (mode === 'eat' && tg.happy > 0.9);
      ear.t = afraid ? 0.38 : alert ? 1.3 : easy ? 0.55 : 1;
      // the nose sniffs faster the more aroused it is, and stops when it is
      // deeply relaxed; sniffing is breath-locked (Kurnikova et al. 2017, in rats)
      const arousal = afraid || alert ? 1 : easy ? 0 : mode === 'freeze' ? 0 : 0.4;
      if (tg.mouth < 0.06 && arousal > 0 && mode !== 'freeze') {
        const hz = 2.5 + 5.5 * arousal, gate = 0.4 + 0.5 * Math.sin(now * 0.7) ** 2;   // sniffing comes and goes
        if (Math.sin(now * TAU * 0.35) > -gate) tg.mouth = 0.075 + 0.05 * (Math.sin(now * TAU * hz) > 0.2 ? 1 : 0);
      }
    }
    tg.sy -= Math.abs(wind) * 0.25; tg.sx += Math.abs(wind) * 0.15;
    tg.mode = mode;
    return tg;
  }

  function merge(tg, g) {
    if (g.arms) g.arms.forEach((a, i) => { if (a) tg.arms[i] = a; });
    for (const k of ['sx', 'sy', 'sc', 'tilt', 'lid', 'happy', 'mouth']) if (g[k] != null) tg[k] = g[k];
  }
  // a bite: bits of radish fly, the cheeks bulge, a little shudder
  function chomp() {
    const m = mouthOnScreen();
    for (let i = 0; i < 5; i++) {
      bits.push({ x: m.x + rnd(-3, 3), y: m.y, vx: rnd(-110, 110), vy: rnd(-190, -70), t: nowS(),
        col: pick(['#E9476B', '#E9476B', '#F7E4E6', '#5CCB78']), r: rnd(0.9, 1.9) });
    }
    puff.vel += 6; jelly(1.4); S.sy.vel -= 0.8;
  }
  // down it goes: the belly swells, and it says how that felt
  function gulp() {
    crumbs = crumbs.filter(c => c !== eating.crumb);
    full += PER_RADISH;
    S.sy.vel -= 2.4; jelly(4, 2);
    later.push({ at: nowS() + 0.18, fn: () => { belly.vel += 3.5; for (let i = 7; i < 14; i++) wobV[i] += 2.2; } });
    if (full > FULL) {                                // that one tipped it over
      say('stuffed', { force: true });
      later.push({ at: nowS() + 1.3, fn: () => {
        say('burp', { force: true }); S.mouth.v = 0.9; S.sy.vel += 6; S.sx.vel -= 4; jelly(7, 3);
        later.push({ at: nowS() + 1.4, fn: () => say('sorry', { force: true }) });
      } });
    } else say(full > 0.6 ? 'stuffed' : 'eat', { force: true });
  }
  const mouthOnScreen = () => ({ x: p.x + face.v * R * 0.22, y: p.y - hop + R * 0.32 * S.sc.v });

  function nearestCrumb() {
    let best = null, bd = 1e9;
    for (const c of crumbs) { const d = Math.hypot(c.x - p.x, c.y - scrollY - p.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function linkAhead() {
    const sp = Math.hypot(ptr.vx, ptr.vy), ux = ptr.vx / sp, uy = ptr.vy / sp;
    for (const a of links()) {
      const r = a.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = cx - ptr.x, dy = cy - ptr.y, d = Math.hypot(dx, dy);
      if (d < 160 || d > 520) continue;
      if ((dx * ux + dy * uy) / d > 0.93) return a;
    }
    return null;
  }
  function shoo() {
    if (!block || block.shooed) return;
    block.shooed = true;
    jump(220); S.happy.v = 1; jelly(4);
    say('shoo', { force: true });
    const r = block.el.getBoundingClientRect();
    inspect = { x: r.right + 70, y: r.top + r.height / 2 - 12, since: nowS(), until: nowS() + 1.6, poked: nowS() + 99 };
    block = null;
  }

  // ── courier ──
  const centre = r => ({ x: r.left + r.width / 2, y: r.top + r.height * 0.4 });
  const headSpot = () => ({ x: p.x, y: p.y - hop - R * 1.5 * S.sc.v });
  function toss(a, b, o = {}) { parcels.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, since: nowS(), dur: 0.32, s0: 1, s1: 1, ...o }); }
  // out of the thing's middle, in an arc, onto its head
  function pickUp(r) {
    courier.pending = true;
    toss(centre(r), headSpot(), { s0: 0.3, then: () => { parcel = true; if (courier) courier.pending = false; squash(0.3); jelly(2); } });
  }
  // off its head, in an arc, into the thing, shrinking as it goes in
  function handOver(r, then) {
    parcel = false;
    toss(headSpot(), centre(r), { s1: 0.3, then });
    S.sy.vel += 2; jelly(1.5);
  }
  // knocked out of its hands: it tumbles off and fades
  function dropParcel() {
    if (!parcel) return;
    parcel = false;
    const h = headSpot();
    parcels.push({ fall: true, x: h.x, y: h.y, vx: rnd(-90, 90), vy: -rnd(120, 200), since: nowS(), rot: 0, spin: rnd(-7, 7) });
    if (courier) { courier.leg = 'fetch'; courier.busyUntil = 0; }
  }
  function poof() {
    if (!parcel) return;
    parcel = false;
    const h = headSpot();
    for (let i = 0; i < 10; i++) bits.push({ x: h.x + rnd(-R * 0.6, R * 0.6), y: h.y + rnd(-R * 0.4, R * 0.4), vx: rnd(-120, 120), vy: rnd(-200, -60), t: nowS(), col: i % 2 ? '#C98F55' : '#E8CF9F', r: rnd(1, 2.2) });
  }
  // a puff kicked up behind its feet when it sprints
  const dust = () => bits.push({ x: p.x - Math.sign(v.x) * R * 0.6, y: p.y + R * 0.9, vx: -v.x * 0.15 + rnd(-20, 20), vy: -rnd(60, 120), t: nowS(), col: ink, r: rnd(0.8, 1.6) });

  // One frame of courier work. The job says where from and where to, which end
  // is the visitor's own, and what is going on: 'wait' (nobody at the other
  // end yet), 'go' (shuttling), 'stuck' (the other end went quiet mid-way) or
  // 'idle' (nothing to carry: it lives as usual). Sets the pose on tg and
  // returns { mode, look }, or null to leave it to everything else.
  function runCourier(tg, now, dt) {
    const c = courier, j = c.job;
    const a = j.from(), b = j.to();
    if (c.done || !a || !b || !a.width || !b.width) {
      if (c.done || c.ending) { poof(); courier = null; }
      return null;
    }
    let st = j.state ? j.state() : 'go';
    if (c.ending || (st === 'idle' && c.leg === 'carry' && parcel)) st = 'go';   // finish the delivery in hand
    if (st !== c.st) { c.st = st; c.since = now; }
    const e = now - c.since;
    const dir = Math.sign(centre(b).x - centre(a).x) || 1;
    // it stands on the line the two things sit on, just beside each one, on the side facing the other
    const beside = (r, d) => ({ x: clamp(d > 0 ? r.right + R * 1.35 : r.left - R * 1.35, R + 4, innerWidth - R - 4), y: clamp(r.bottom - R * 0.95, R + 4, innerHeight - R - 4) });
    const atFrom = beside(a, dir), atTo = beside(b, -dir);
    const mineTo = j.mine === 'to', mine = mineTo ? b : a, other = mineTo ? a : b, home = mineTo ? atTo : atFrom;
    const lookAt = r => { const q = centre(r); return { x: q.x - p.x, y: q.y - p.y }; };
    const HOLD = [[-1.3, 1.05], [PI + 1.3, 1.05]];

    if (st === 'idle') {
      if (parcel && !c.pending) { parcel = false; toss(headSpot(), centre(mine), { s1: 0.3 }); }   // put it back
      c.leg = 'fetch';
      return null;
    }

    if (st === 'wait') {
      // by its own one, the parcel ready if it is the sender, tapping a foot,
      // and every few seconds up on tiptoe to look for the other end
      if (!mineTo && !parcel && !c.pending && Math.hypot(home.x - p.x, home.y - p.y) < R * 2) pickUp(a);
      tg.x = home.x; tg.y = home.y; tg.k = 50; tg.vmax = 420;
      const tap = Math.max(0, Math.sin(e * 7)), tall = Math.max(0, Math.sin(e * 1.2 - 1)) ** 6;
      tg.sy = 1 + 0.16 * tall - 0.03 * tap; tg.sx = 1 - 0.08 * tall;
      tg.y -= R * 0.15 * tall; tg.tilt = 0.05 * Math.sin(e * 3.5);
      tg.arms = parcel || c.pending ? HOLD : [[1.95, 0.45], [PI - 1.95, 0.45]];
      if (e > 6 && now > (c.mutterAt || 0)) { say('waitfor', { chance: 0.6 }); c.mutterAt = now + rnd(8, 13); }
      return { mode: 'courier-wait', look: lookAt(other) };
    }

    if (st === 'stuck') {
      // the other end went quiet: it stops where it is, hugs what it has and looks over
      if (parcel) parcelAt = 'chest';
      tg.k = 30; tg.sy = 0.9; tg.sx = 1.06; tg.lid = 0.62; tg.scared = 0.3;
      tg.arms = parcel ? [[2.16, 0.62], [PI - 2.16, 0.62]] : [[1.3, 0.3], [PI - 1.3, 0.3]];
      tg.tilt = 0.05 * Math.sin(e * 1.4);
      return { mode: 'courier-stuck', look: lookAt(other) };
    }

    // go: back and forth, faster the faster things are moving
    const pace = clamp(j.pace ? j.pace() : 0.4, 0, 1), speed = 300 + 560 * pace;
    if (now < c.busyUntil || c.pending) {
      tg.k = 120; tg.arms = HOLD;
      return { mode: 'courier-hand', look: { x: 0, y: -0.8, abs: true } };
    }
    const sprint = pace > 0.5 && Math.abs(v.x) > 200 && Math.random() < dt * 25;
    if (c.leg === 'fetch') {
      tg.x = atFrom.x; tg.y = atFrom.y; tg.k = 60; tg.vmax = speed;
      const sw = 0.45 * Math.sin(now * 13);
      tg.arms = [[0.85 + sw, 0.75], [PI - 0.85 + sw, 0.75]]; tg.happy = 0.7;
      if (sprint) dust();
      if (Math.hypot(atFrom.x - p.x, atFrom.y - p.y) < R * 0.6) {
        c.leg = 'carry';
        if (!parcel) { pickUp(a); c.busyUntil = now + 0.36; if (!c.trips) say('post', { chance: 0.8 }); }
      }
      return { mode: 'courier-go', look: lookAt(a) };
    }
    tg.x = atTo.x; tg.y = atTo.y; tg.k = 60; tg.vmax = speed * 0.85;
    tg.arms = HOLD; tg.happy = 0.45; tg.lid = 0.9; tg.mouth = 0.12; tg.tilt = 0.08 * dir;
    if (sprint) dust();
    if (Math.hypot(atTo.x - p.x, atTo.y - p.y) < R * 0.6) {
      if (parcel) {
        handOver(b, () => { c.trips++; j.onDrop?.(); if (c.ending) c.done = true; });
        c.busyUntil = now + 0.3;
        say('dropin', { chance: 0.25 });
      }
      c.leg = 'fetch';
    }
    return { mode: 'courier-go', look: lookAt(b) };
  }

  // ───────────────────────────── moving ─────────────────────────────
  function physics(tg, dt) {
    if (tg.k > 0) {
      v.x += (tg.k * (tg.x - p.x) - 2 * Math.sqrt(tg.k) * 0.8 * v.x) * dt;
      v.y += (tg.k * (tg.y - p.y) - 2 * Math.sqrt(tg.k) * 0.8 * v.y) * dt;
    } else { v.x *= Math.exp(-dt * 1.6); v.y *= Math.exp(-dt * 1.6); }
    const heavy = clamp(belly.v, 0, 1.2);
    const vmax = tg.vmax * (1 - 0.4 * heavy);               // a full belly slows it down
    const sp = Math.hypot(v.x, v.y);
    if (sp > vmax) { v.x *= vmax / sp; v.y *= vmax / sp; }
    p.x += v.x * dt; p.y += v.y * dt;

    const bounce = nowS() < thrownUntil;
    for (const [axis, lo, hi] of [['x', R, innerWidth - R], ['y', R, innerHeight - R]]) {
      if (p[axis] < lo) { p[axis] = lo; if (bounce) { v[axis] = -v[axis] * 0.55; jelly(5, 2); squash(0.5); } else v[axis] = 0; }
      if (p[axis] > hi) { p[axis] = hi; if (bounce) { v[axis] = -v[axis] * 0.55; jelly(5, 2); squash(0.5); } else v[axis] = 0; }
    }

    if (sp > 40 && !carried && !bounce) {
      const before = Math.floor(hopPhase / PI);
      // at a sprint the steps stop getting quicker and land softer, or the
      // squashes come faster than the body can spring back and pin it flat
      hopPhase += dt * Math.min(sp, 520) / (R * 2.2);
      hop = Math.abs(Math.sin(hopPhase)) * R * 0.5 * clamp(sp / 300, 0.3, 1) * (1 - 0.55 * heavy);
      if (Math.floor(hopPhase / PI) !== before) squash(0.25 * clamp(300 / sp, 0.35, 1));
    } else hop *= Math.exp(-dt * 14);

    tick(S.sx, 80, 0.6, dt); tick(S.sy, 80, 0.6, dt);
    for (const [q, lo, hi] of [[S.sx, 0.72, 1.32], [S.sy, 0.66, 1.38]]) if (q.v < lo || q.v > hi) { q.v = clamp(q.v, lo, hi); q.vel *= -0.3; } tick(S.sc, 60, 0.55, dt);
    tick(S.tilt, 50, 0.8, dt); tick(S.lid, 400, 1, dt); tick(S.happy, 30, 0.9, dt); tick(S.scared, 20, 0.9, dt); tick(S.mouth, 120, 0.8, dt);
    tick(S.look[0], 320, 0.9, dt); tick(S.look[1], 320, 0.9, dt);
    tick(sac[0], 1600, 1, dt); tick(sac[1], 1600, 1, dt);
    tick(face, 45, 0.85, dt);
    full = Math.max(0, full - DIGEST * dt);
    belly.t = clamp(full, 0, 1.3);
    tick(belly, 22, 0.35, dt); tick(puff, 160, 0.5, dt);
    for (const q of parcels) if (q.fall) { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.spin * dt; }
    for (const b of bits) { b.vy += 760 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.exp(-dt * 2); }
    for (const g of germs) {
      const age = nowS() - g.born;
      if (g.state === 'walk') {
        const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
        if (d < 3) g.state = 'nibble';
        else { const sp = Math.min(d, 70 * dt); g.x += dx / d * sp; g.y += dy / d * sp; if (Math.abs(dx) > 1) g.face = Math.sign(dx); }
      } else if (g.state === 'nibble') {
        // chewing the word: flecks of ink fly off
        if (Math.random() < dt * 7) bits.push({ x: g.x + rnd(-4, 4), y: g.y - scrollY + R * 0.15, vx: rnd(-60, 60), vy: rnd(-120, -40), t: nowS(), col: ink, r: rnd(0.6, 1.2) });
        if (age > 16) g.state = 'leave';               // nobody came: it wanders off
      } else if (g.state === 'leave') {
        g.x += 90 * dt; g.face = 1;
        if (g.x > innerWidth + 40) g.gone = true;
      } else if (g.state === 'launched') {
        g.vy += 900 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.rot = (g.rot || 0) + g.spin * dt;
        if (g.y - scrollY > innerHeight + 80 || nowS() - g.launchedAt > 2.5) g.gone = true;
      }
    }
    if (germs.some(g => g.gone)) germs = germs.filter(g => !g.gone);
    tick(bubblePop, 320, 0.45, dt);
    tick(wag, 40, 0.8, dt); tick(ear, 120, 0.5, dt);
    // radishes a cat has batted: they fly, bounce off the edges and settle
    for (const c of crumbs) if (c.flying) {
      c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot = (c.rot || 0) + c.vx * dt * 0.04;
      if (c.x < 10 || c.x > innerWidth - 10) { c.vx *= -0.6; c.x = clamp(c.x, 10, innerWidth - 10); }
      if (c.y >= c.gy && c.vy > 0) { c.y = c.gy; c.vy *= -0.38; c.vx *= 0.7; if (Math.abs(c.vy) < 70) c.flying = false; }
    }

    // the sprout's tip hangs off a spring toward where it would point if nothing
    // moved: straight up out of the head, drooping when asleep, stiff when scared
    const a = sproutAnchor(), { lean, len } = sproutPose();
    const rx = a.x + Math.sin(lean) * len, ry = a.y - Math.cos(lean) * len;
    const stiff = S.scared.v > 0.5 || (BUN && (ear.v > 1.12 || ear.v < 0.45));
    const sk = stiff ? 520 : 170, sz = stiff ? 0.8 : 0.3;
    tip.vx += (sk * (rx - tip.x) - 2 * Math.sqrt(sk) * sz * tip.vx) * dt;
    tip.vy += (sk * (ry - tip.y) - 2 * Math.sqrt(sk) * sz * tip.vy + 60) * dt;   // a little weight
    tip.x += tip.vx * dt; tip.y += tip.vy * dt;
    // it is a stalk, not a string: keep it near its length
    const dx = tip.x - a.x, dy = tip.y - a.y, d = Math.hypot(dx, dy) || 1;
    if (d > len * 1.25 || d < len * 0.6) { const k = clamp(d, len * 0.6, len * 1.25) / d; tip.x = a.x + dx * k; tip.y = a.y + dy * k; }
    for (const arm of S.arms) { tick(arm[0], 110, 0.55, dt); tick(arm[1], 90, 0.6, dt); }
    for (let i = 0; i < N; i++) { wobV[i] += (-160 * wob[i] - 2 * Math.sqrt(160) * 0.25 * wobV[i]) * dt; wob[i] += wobV[i] * dt; }
    wind *= Math.exp(-dt * 5);
  }

  function setTargets(tg, now) {
    S.sx.t = tg.sx; S.sy.t = tg.sy; S.sc.t = tg.sc; S.tilt.t = tg.tilt;
    S.happy.t = tg.happy; S.scared.t = tg.scared; S.mouth.t = tg.mouth;
    S.look[0].t = tg.look[0]; S.look[1].t = tg.look[1];
    tg.arms.forEach((a, i) => { S.arms[i][0].t = a[0]; S.arms[i][1].t = a[1]; });
    if (now > nextBlinkAt && !asleep) { S.lid.t = 0.05; nextBlinkAt = now + (Math.random() < 0.2 ? 0.35 : rnd(2, 6)); setTimeout(() => { S.lid.t = tg.lid; }, 90); }
    else if (S.lid.t !== 0.05 || now > nextBlinkAt - 0.1) S.lid.t = tg.lid;
    // talking: the mouth opens on each vowel as it is typed out
    if (bubble && bubble.kind === 'say') {
      const ch = bubble.text[Math.floor((now - bubble.since) * 30)];
      if (ch) S.mouth.t = Math.max(S.mouth.t, /[aeiouy]/i.test(ch) ? 0.5 : /[a-z]/i.test(ch) ? 0.16 : 0);
    }
  }

  // how the sprout stands: leaning with the body, drooping in sleep; a pup wags
  // it like a tail, a bunny's is an ear that perks up and flops down
  function sproutPose() {
    let lean = S.tilt.v + flipAngle(nowS()) + face.v * 0.18, len = R * 0.85;
    if (asleep) { lean += 1.15; len = R * 0.7; }
    if (BUN) { len = R * 0.85 * clamp(ear.v, 0.38, 1.4); lean += (1 - clamp(ear.v, 0.35, 1)) * 1.6 * (face.v >= 0 ? 1 : -1); }
    if (PUP) lean += wag.v * 0.6 * Math.sin(t * 17);
    return { lean, len };
  }

  // the top of its head, in window px, where the sprout grows from
  function sproutAnchor() {
    const sc = S.sc.v, top = R * 0.98 * 1.04 * sc * S.sy.v * 0.94, tl = S.tilt.v + flipAngle(nowS());
    const fx = face.v * R * 0.12 * sc;
    return { x: p.x + Math.sin(tl) * top + fx * Math.cos(tl), y: p.y - hop - Math.cos(tl) * top + fx * Math.sin(tl) };
  }

  // ───────────────────────────── drawing ─────────────────────────────
  // its food: a radish, drawn from the paths of a 32×32 SVG (radish.svg)
  const RADISH = typeof Path2D === 'undefined' ? null : {
    leaves: [
      [new Path2D('M15.6 10.2 C 13.4 6.4 9.2 5.2 7.4 6.6 C 9.4 7.2 11.8 8.6 14.4 11.4 Z'), '#4CBF6A'],
      [new Path2D('M16.4 10.2 C 18.6 6.4 22.8 5.2 24.6 6.6 C 22.6 7.2 20.2 8.6 17.6 11.4 Z'), '#3FAE5C'],
      [new Path2D('M16 10.6 C 15.2 6.6 16 3.4 17.6 2.4 C 17.8 5 17.4 8 16.6 11.2 Z'), '#5CCB78'],
    ],
    tail: new Path2D('M16.2 25.4 C 16.6 27.6 15.6 29.2 14.2 30.2'),
    body: new Path2D('M16 10.4 C 22.4 10.4 25.4 14.4 25.4 18.4 C 25.4 22.6 21 26.2 16.6 26.2 C 12 26.2 7 22.8 7 18.4 C 7 14.2 10 10.4 16 10.4 Z'),
    tip: new Path2D('M10.6 22.2 C 12.2 24.8 14.4 26.2 16.6 26.2 C 19 26.2 21.4 24.8 23 22.4 C 20 24.4 13.8 24.6 10.6 22.2 Z'),
  };
  // centred on its body (16, 18 in the SVG), s px per SVG unit
  function drawRadish(x, y, s, rot) {
    if (!RADISH) { ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 6 * s, 0, TAU); ctx.fill(); return; }
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(-16, -18);
    for (const [path, colour] of RADISH.leaves) { ctx.fillStyle = colour; ctx.fill(path); }
    ctx.strokeStyle = '#F3E6E2'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke(RADISH.tail);
    ctx.fillStyle = '#E9476B'; ctx.fill(RADISH.body);
    ctx.fillStyle = '#F7E4E6'; ctx.fill(RADISH.tip);
    ctx.globalAlpha *= 0.85; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(11.6, 14.6, 1.6, 2.2, -25 * PI / 180, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(13.8, 12.6, 0.7, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const bounceOut = x => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };

  function outline() {
    const pts = [], sc = S.sc.v;
    for (let i = 0; i < N; i++) {
      const a = i * TAU / N, s = Math.sin(a), c = Math.cos(a);
      let x = c * R, y = s * R * 0.98;
      if (s > 0) { x *= 1 + 0.14 * s; y *= 0.9; } else y *= 1.04;     // a little wider at the bottom
      // fat goes on the belly, not everywhere: the lower half widens and sags,
      // most at the bottom, while the head and shoulders stay as they were
      const b = Math.max(0, belly.v);
      if (s > 0) { x *= 1 + 0.5 * b * Math.pow(s, 1.1); y *= 1 + 0.22 * b * s; }
      // cheeks puffed out with radish, at about eye level on either side
      x *= 1 + 0.1 * Math.max(0, puff.v) * Math.exp(-(((s - 0.12) / 0.28) ** 2)) * Math.abs(c);
      const w = 1 + wob[i] * 0.022 + 0.008 * Math.sin(t * 1.3 + i * 1.7);
      pts.push([x * w * sc, y * w * sc]);
    }
    return pts;
  }

  function draw() {
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const now = nowS();

    // radishes: they drop in with a bounce, and wobble and shrink as they are eaten
    for (const c of crumbs) {
      const e = bounceOut(Math.min(1, (now - (c.born ?? 0)) / 0.55));
      if (eating && eating.crumb === c && now - eating.since >= 0.3) continue;   // in its hands now
      if (c === hoarding) { drawRadish(p.x, p.y - hop - R * 1.35, R * 1.1 / 32, 0.15 * Math.sin(now * 9)); continue; }
      drawRadish(c.x, c.y - scrollY - 24 * (1 - e), R * 1.2 / 32, c.rot ?? 0);
    }
    zs = zs.filter(z => now - z.t < 2.4);
    if (zs.length) ctx.font = `italic 13px ${getComputedStyle(document.body).fontFamily}`;
    for (const z of zs) { const age = now - z.t; ctx.globalAlpha = Math.max(0, 1 - age / 2.4); ctx.fillText('z', z.x + age * 9, z.y - age * 16); }
    ctx.globalAlpha = 1;

    for (const g of germs) drawGerm(g, now);
    if (fight) { drawFight(now); drawBits(now); drawBubble(now); return; }   // nothing to see but dust

    // a soft shadow where it stands, shrinking as it leaves the ground
    if (!carried) {
      const s = clamp(1 - hop / (R * 1.3), 0.45, 1) * S.sc.v;
      ctx.globalAlpha = 0.12 * s; ctx.fillStyle = ink;
      const b = Math.max(0, belly.v);
      ctx.beginPath(); ctx.ellipse(p.x, p.y + R * (0.98 + 0.16 * b) * S.sc.v, R * (0.95 + 0.42 * b) * s, R * 0.2 * s, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // the sprout: a stalk from the head to the trailing tip, and a leaf
    {
      const a = sproutAnchor(), { lean, len } = sproutPose();
      const cx = a.x + Math.sin(lean) * len * 0.5, cy = a.y - Math.cos(lean) * len * 0.5;
      ctx.strokeStyle = fg; ctx.fillStyle = fg; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, R * 0.09);
      ctx.beginPath(); ctx.moveTo(a.x, a.y + 2); ctx.quadraticCurveTo(cx, cy, tip.x, tip.y); ctx.stroke();
      const ang = Math.atan2(tip.y - cy, tip.x - cx), lr = R * 0.22;
      ctx.beginPath();
      ctx.ellipse(tip.x + Math.cos(ang) * lr * 0.75, tip.y + Math.sin(ang) * lr * 0.75, lr, lr * 0.48, ang, 0, TAU);
      ctx.fill();
    }

    const dir = Math.atan2(v.y, v.x), sp = Math.hypot(v.x, v.y);
    const stretch = carried ? 0 : clamp(sp / 1400, 0, 0.12);
    const sc = S.sc.v, lid = clamp(S.lid.v, 0.04, 1.15), scared = S.scared.v, happy = S.happy.v;
    const inAir = hop > 2 || now < thrownUntil;

    ctx.translate(p.x, p.y - hop);
    ctx.rotate(S.tilt.v + flipAngle(now) + (sp > 40 && !carried ? 0.11 * clamp(belly.v, 0, 1.2) * Math.sin(hopPhase) : 0));
    ctx.rotate(dir); ctx.scale(1 + stretch, 1 - stretch * 0.6); ctx.rotate(-dir);
    ctx.scale(S.sx.v, S.sy.v);

    // feet, tucked up in the air
    const fat = Math.max(0, belly.v);
    const feetY = R * (0.9 + 0.16 * fat) * sc - (inAir ? R * 0.18 : 0);
    ctx.lineWidth = 1.2; ctx.strokeStyle = bg; ctx.fillStyle = fg;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(side * R * (0.36 + 0.18 * fat) * sc, feetY, R * 0.24 * sc, R * (inAir ? 0.09 : 0.13) * sc, 0, 0, TAU);
      ctx.fill(); ctx.stroke();
    }
    // rubber-hose arms: they curve against the way they are swinging, so the
    // hand arrives a moment after the elbow would (follow-through, drag)
    const arms = () => {
      for (let i = 0; i < 2; i++) {
        const ang = S.arms[i][0].v, len = Math.max(0.05, S.arms[i][1].v) * ARM * sc, s = SHOULDER[i];
        const x0 = s.x * sc, y0 = s.y * sc, x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
        const bend = clamp(-S.arms[i][0].vel * 0.03, -0.55, 0.55) + (i === 0 ? 0.1 : -0.1);
        const mx = (x0 + x1) / 2 - Math.sin(ang) * len * bend, my = (y0 + y1) / 2 + Math.cos(ang) * len * bend;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
      }
    };
    // while it holds food the arms come round in front of the body, edged in
    // the page colour so they read against it
    const meal = eating && now - eating.since >= 0.3 && now - eating.since < 2.7 ? now - eating.since : 0;
    const hug = parcel && parcelAt === 'chest';
    ctx.lineCap = 'round';
    if (!meal && !hug) { ctx.strokeStyle = fg; ctx.lineWidth = R * 0.34 * sc; arms(); }
    // body
    const pts = outline();
    ctx.beginPath();
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const st = m(pts[N - 1], pts[0]);
    ctx.moveTo(st[0], st[1]);
    for (let i = 0; i < N; i++) { const e = m(pts[i], pts[(i + 1) % N]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    ctx.closePath();
    ctx.fillStyle = fg; ctx.fill();
    // a rounder belly gets a soft lighter patch, and past a point a belly button
    if (fat > 0.15) {
      const k = Math.min(1, fat);
      ctx.globalAlpha = 0.13 * k; ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(face.v * R * 0.08, R * (0.42 + 0.14 * fat) * sc, R * (0.3 + 0.38 * fat) * sc, R * (0.22 + 0.2 * fat) * sc, 0, 0, TAU); ctx.fill();
      if (fat > 0.55) { ctx.globalAlpha = 0.4 * Math.min(1, (fat - 0.55) * 3); ctx.beginPath(); ctx.arc(face.v * R * 0.08, R * (0.5 + 0.17 * fat) * sc, R * 0.045 * sc, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // face
    const lx = S.look[0].v + sac[0].v, ly = S.look[1].v + sac[1].v;
    // turning: the face slides toward the way it faces, the far eye narrows
    const f = clamp(face.v, -1, 1), fx = f * R * 0.2 * sc;
    const ex = R * 0.27 * sc * (1 + scared * 0.15) * (1 - 0.22 * Math.abs(f)), ey = -R * 0.12 * sc;
    const rx0 = R * 0.17 * sc * (1 - scared * 0.25), ry = R * 0.24 * sc * (1 + scared * 0.2) * lid;
    const dizzy = now < dizzyUntil;
    ctx.fillStyle = bg; ctx.strokeStyle = bg; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const rx = rx0 * (1 + 0.16 * side * f);
      const cx = side * ex + fx + lx * R * 0.1, cy = ey + ly * R * 0.09;
      if (dizzy) {
        // spirals, turning
        ctx.lineWidth = Math.max(1, R * 0.07); ctx.beginPath();
        for (let a = 0; a <= 3 * PI; a += 0.25) {
          const rr = (a / (3 * PI)) * R * 0.2 * sc, q = a * side + now * 9;
          a ? ctx.lineTo(cx + Math.cos(q) * rr, cy + Math.sin(q) * rr) : ctx.moveTo(cx, cy);
        }
        ctx.stroke();
      } else if (happy > 0.55) {
        ctx.lineWidth = R * 0.15 * sc; ctx.beginPath(); ctx.arc(cx, cy + R * 0.08 * sc, R * 0.16 * sc, PI + 0.2, TAU - 0.2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, Math.max(0.7, ry), 0, 0, TAU); ctx.fill();
        if (lid > 0.35) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx - rx * 0.32 + lx * rx * 0.2, cy - ry * 0.38 + ly * ry * 0.15, rx * 0.34, 0, TAU); ctx.fill(); ctx.fillStyle = bg; }
      }
    }
    // cheeks, when it is pleased
    if ((happy > 0.2 || puff.v > 0.2) && !dizzy) {
      ctx.globalAlpha = 0.3 * clamp(Math.max(happy, puff.v), 0, 1);
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * R * 0.5 * (1 - 0.2 * Math.abs(f)) + fx, R * 0.14 * sc, R * 0.12 * sc, R * 0.065 * sc, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    const mo = S.mouth.v, my = R * 0.3 * sc;
    ctx.translate(fx * 1.1, 0);
    if (mo > 0.06) { ctx.beginPath(); ctx.ellipse(0, my + mo * R * 0.05, R * 0.1 * mo * sc + 0.5, R * 0.14 * mo * sc + 0.5, 0, 0, TAU); ctx.fill(); }
    else if (happy > 0.25) { ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, my - R * 0.04 * sc, R * 0.13 * sc * happy, 0.35, PI - 0.35); ctx.stroke(); }
    ctx.translate(-fx * 1.1, 0);
    if (parcel && !hug) drawParcel(fx * 0.4, -R * 1.5 * sc, sc, 0.04 * Math.sin(t * 3));   // up on its head
    if (hug) {
      // hugged to its chest, the arms round the front of it
      drawParcel(fx * 0.8, R * 0.42 * sc, sc * 0.8, 0);
      ctx.strokeStyle = bg; ctx.lineWidth = R * 0.34 * sc + 2.4; arms();
      ctx.strokeStyle = fg; ctx.lineWidth = R * 0.34 * sc; arms();
    }
    if (meal) {
      ctx.strokeStyle = bg; ctx.lineWidth = R * 0.34 * sc + 2.4; arms();
      ctx.strokeStyle = fg; ctx.lineWidth = R * 0.34 * sc; arms();
      if (meal < 1.5) {
        // held under the chin in both hands, lifted to the mouth on each chew,
        // a bit smaller after every bite, with a little wiggle as it is gnawed
        const k = (meal - 0.3) / 1.2, chew = Math.abs(Math.sin(k * 3 * PI));
        const left = clamp(1 - Math.max(0, eating.bites) / 3.4 - 0.12 * (k * 3 % 1), 0.3, 1);
        drawRadish(fx * 0.8, R * (0.56 - 0.12 * chew) * sc, (R * 1.15 / 32) * sc * left, 0.18 * Math.sin(meal * 20));
      }
    }
    drawBits(now);
    drawFlying(now);
    drawBubble(now);
  }

  // a cardboard parcel, taped, with a radish stamp on it: it is from Mooli
  function drawParcel(x, y, s, rot = 0) {
    const w = R * 1.3 * s, h = R * 0.95 * s;
    if (w < 1) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, R * 0.07 * s);
    ctx.fillStyle = '#C98F55'; ctx.strokeStyle = '#7A4E26';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, R * 0.12 * s); else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E8CF9F'; ctx.fillRect(-w * 0.1, -h / 2 + 1, w * 0.2, h - 2);
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.2); ctx.lineTo(w / 2, -h * 0.2); ctx.stroke();
    drawRadish(w * 0.29, h * 0.14, (R * 0.5 / 32) * s, -0.2);
    ctx.restore();
  }

  // parcels between it and the page: arcing in and out of things, or tumbling
  function drawFlying(now) {
    if (!parcels.length) return;
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const q of parcels) {
      const e = now - q.since;
      if (q.fall) { ctx.globalAlpha = clamp(1 - (e - 0.5) / 0.4, 0, 1); drawParcel(q.x, q.y, 1, q.rot); continue; }
      const u = clamp(e / q.dur, 0, 1), k = u * u * (3 - 2 * u);
      drawParcel(q.x0 + (q.x1 - q.x0) * k, q.y0 + (q.y1 - q.y0) * k - Math.sin(PI * u) * R * 1.3, q.s0 + (q.s1 - q.s0) * k, 0.5 * Math.sin(PI * u));
    }
    ctx.globalAlpha = 1;
  }

  // a carrot virus: a carrot with a spiky leafy crown and a cross little face
  function drawGerm(g, now) {
    if (g.state === 'fighting') return;
    const age = now - g.born, grow = Math.min(1, age / 0.25);
    const H = R * 1.25 * grow, W = R * 0.78 * grow;
    if (H < 1) return;
    const x = g.x, y = g.y - scrollY;
    const walking = g.state === 'walk' || g.state === 'leave', chew = g.state === 'nibble' ? Math.sin(age * 20) : 0;
    const bob = walking ? Math.abs(Math.sin(age * 12)) * R * 0.18 : 0;
    ctx.save();
    if (g.state !== 'launched') {
      ctx.globalAlpha = 0.12; ctx.fillStyle = ink;
      ctx.beginPath(); ctx.ellipse(x, y + H * 0.55, W * 0.45, H * 0.08, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.translate(x, y - bob);
    ctx.rotate((g.rot || 0) + (walking ? 0.12 * Math.sin(age * 12) : 0.05 * chew));
    ctx.scale(g.face || 1, 1);
    // the crown: spiky leaves, the "virus" part
    ctx.fillStyle = '#4CBF6A';
    for (let i = -2; i <= 2; i++) {
      const a = -PI / 2 + i * 0.42 + 0.12 * Math.sin(age * 14 + i), L = H * (0.34 + 0.07 * (2 - Math.abs(i)));
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * L * 0.5, -H * 0.42 + Math.sin(a) * L * 0.5, L * 0.5, W * 0.11, a, 0, TAU); ctx.fill();
    }
    // the body: wide at the top, down to a point, with a few ridges
    ctx.fillStyle = '#F28C28';
    ctx.beginPath(); ctx.moveTo(-W / 2, -H * 0.4); ctx.quadraticCurveTo(0, -H * 0.56, W / 2, -H * 0.4);
    ctx.quadraticCurveTo(W * 0.36, H * 0.12, 0, H * 0.55); ctx.quadraticCurveTo(-W * 0.36, H * 0.12, -W / 2, -H * 0.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#C8661A'; ctx.lineWidth = Math.max(1, R * 0.06); ctx.lineCap = 'round';
    for (const [yy, w] of [[0.02, 0.26], [0.2, 0.18], [0.36, 0.1]]) { ctx.beginPath(); ctx.moveTo(-W * w, H * yy); ctx.lineTo(W * w * 0.3, H * yy + H * 0.03); ctx.stroke(); }
    // a cross little face: eyes, slanted brows, a chomping mouth
    const ex = W * 0.17, ey = -H * 0.2, er = W * 0.11;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sd * ex, ey, er, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(sd * ex + er * 0.3, ey + er * 0.15, er * 0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = Math.max(1, R * 0.07);
      ctx.beginPath(); ctx.moveTo(sd * (ex + er), ey - er * 1.7); ctx.lineTo(sd * (ex - er), ey - er * 0.9); ctx.stroke();
    }
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath(); ctx.ellipse(0, H * 0.02, W * 0.12, H * 0.035 * (0.6 + 0.9 * Math.max(0, chew)), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // The fight: a cartoon dust cloud, shaking, with fists and feet poking out
  // (its teal, the carrot's orange), stars, and POW! BONK! popping out the top.
  // The shape is re-rolled 14 times a second so it boils.
  const hash = n => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
  function star(x, y, r, col) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
  }
  function drawFight(now) {
    const f = fight, e = now - f.since, u = R * 1.9, seed = Math.floor(now * 14);
    ctx.save();
    ctx.translate(f.x + 3 * Math.sin(now * 61), f.y + 2 * Math.cos(now * 47));
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = hash(seed * 7 + i) * TAU, L = u * (1.2 + 0.45 * hash(seed * 3 + i)), mine = i % 2 === 0;
      ctx.strokeStyle = mine ? fg : '#F28C28'; ctx.lineWidth = R * (mine ? 0.32 : 0.22);
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * u * 0.5, Math.sin(a) * u * 0.5); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(Math.cos(a) * L, Math.sin(a) * L, R * (mine ? 0.2 : 0.16), 0, TAU); ctx.fill();
    }
    const puffs = [[0, 0, u * 0.7]];
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.3 * hash(seed + i); puffs.push([Math.cos(a) * u * 0.62, Math.sin(a) * u * 0.5, u * (0.42 + 0.14 * hash(seed * 5 + i))]); }
    ctx.strokeStyle = ink; ctx.lineWidth = 3;
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = bg;
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { const a = hash(seed * 11 + i) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * u * 0.25, Math.sin(a) * u * 0.2, u * 0.18, a, a + 3.5); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { const a = hash(seed * 13 + i) * TAU, d = u * (0.95 + 0.3 * hash(seed * 17 + i)); star(Math.cos(a) * d, Math.sin(a) * d * 0.8, R * 0.32, '#F2C14E'); }
    const n = Math.floor(e / 0.38), k = (e % 0.38) / 0.38, pop = 0.7 + 0.5 * Math.min(1, k * 4);
    const word = ['POW!', 'BONK!', 'THMP!', 'ZAP!'][n % 4];
    ctx.save();
    ctx.translate((hash(n * 3 + 1) - 0.5) * u * 1.4, -u * 0.95); ctx.rotate(-0.15 + 0.3 * hash(n + 7)); ctx.scale(pop, pop);
    ctx.font = `italic 800 ${Math.round(R * 0.85)}px ${fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = bg; ctx.strokeText(word, 0, 0); ctx.fillStyle = ink; ctx.fillText(word, 0, 0);
    ctx.restore();
    ctx.restore();
    ctx.textAlign = 'start';
  }

  // crumbs of radish flying off each bite
  function drawBits(now) {
    bits = bits.filter(b => now - b.t < 0.7);
    if (!bits.length) return;
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const b of bits) {
      ctx.globalAlpha = 1 - (now - b.t) / 0.7; ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // colours as [r, g, b], whatever CSS form they come in, so they can be mixed
  const rgbOf = c => {
    ctx.fillStyle = '#000'; ctx.fillStyle = c;            // the canvas normalises it
    const v = ctx.fillStyle;
    if (v[0] === '#') return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
    return v.match(/[\d.]+/g).slice(0, 3).map(Number);
  };
  const mix = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };

  // Its voice: a pill-shaped speech bubble with a curved tail, or a scalloped
  // thought cloud with two puffs trailing down to its head, in a wash of its own
  // colour. It pops in, floats a little, and each letter hops in as it is typed.
  // Every shape is stroked first and filled after, so only the outer edge of the
  // outline survives and the pieces join without seams.
  function drawBubble(now) {
    if (!bubble) return;
    const age = now - bubble.since, left = bubble.until - now;
    if (left <= 0) { bubble = null; return; }
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const thought = bubble.kind === 'think';
    const fs = Math.round(clamp(R * 0.76, 11, 13));
    ctx.font = `italic 500 ${fs}px ${fontFamily}`;
    const full = ctx.measureText(bubble.text).width;
    const w = Math.ceil(full) + fs * (thought ? 2.2 : 1.8), h = fs + (thought ? 16 : 13);
    const side = p.x < innerWidth * 0.6 ? 1 : -1;
    const hx = p.x + side * R * 0.6, hy = p.y - hop - R * 0.8;          // the tail points here
    const float = Math.sin(age * 2.6) * 1.2;
    const bx = clamp(side > 0 ? hx + 4 : hx - w - 4, 8, innerWidth - w - 8);
    const by = clamp(hy - h - R * (thought ? 1.1 : 0.75), 8, innerHeight - h - 8) + float;

    if (!bubble.colours || now > bubble.colours.at) {     // fg and bg can change with the theme
      bubble.colours = { at: now + 1, fill: mix(bg, fg, 0.13), line: mix(bg, fg, 0.75) };
    }
    const { fill, line } = bubble.colours;

    ctx.save();
    ctx.globalAlpha = clamp(left / 0.25, 0, 1) * clamp(age / 0.06, 0, 1);
    const s = Math.max(0.01, bubblePop.v);
    ctx.translate(hx, hy); ctx.scale(s, s); ctx.translate(-hx, -hy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // the shapes, as functions that add to the current path
    const shapes = [];
    if (thought) {
      // a cloud: a fat pill with bumps along its top and bottom
      const r = h / 2, bump = h * 0.36, n = Math.max(2, Math.round((w - h) / (bump * 1.5)));
      shapes.push(() => { ctx.moveTo(bx + w - r, by + r); ctx.arc(bx + w - r, by + r, r, 0, TAU); });
      shapes.push(() => { ctx.moveTo(bx + r + r, by + r); ctx.arc(bx + r, by + r, r, 0, TAU); });
      for (let i = 0; i <= n; i++) {
        const x = bx + r + (w - h) * (i / n);
        const wobble = i % 2 ? 0.9 : 1.1;
        shapes.push(() => { ctx.moveTo(x + bump * wobble, by + bump * 0.55); ctx.arc(x, by + bump * 0.55, bump * wobble, 0, TAU); });
        shapes.push(() => { ctx.moveTo(x + bump * (2 - wobble), by + h - bump * 0.55); ctx.arc(x, by + h - bump * 0.55, bump * (2 - wobble), 0, TAU); });
      }
      shapes.push(() => ctx.rect(bx + r * 0.6, by + bump * 0.5, w - r * 1.2, h - bump));
      // puffs trailing to its head
      const cx = bx + (side > 0 ? h * 0.55 : w - h * 0.55), cy = by + h;
      for (const [f, pr] of [[0.42, 3.4], [0.78, 2]]) {
        const px = cx + (hx - cx) * f, py = cy + (hy - cy) * f + float * (1 - f);
        shapes.push(() => { ctx.moveTo(px + pr, py); ctx.arc(px, py, pr, 0, TAU); });
      }
    } else {
      // a pill, and a tail that curves down to its head and tapers to a point
      const r = h / 2;
      shapes.push(() => {
        ctx.moveTo(bx + r, by); ctx.lineTo(bx + w - r, by); ctx.arc(bx + w - r, by + r, r, -PI / 2, PI / 2);
        ctx.lineTo(bx + r, by + h); ctx.arc(bx + r, by + r, r, PI / 2, PI * 1.5); ctx.closePath();
      });
      const x0 = clamp(side > 0 ? bx + r * 0.9 : bx + w - r * 0.9 - 12, bx + r * 0.5, bx + w - r * 0.5 - 12), yb = by + h - 2;
      shapes.push(() => {
        ctx.moveTo(x0, yb);
        ctx.quadraticCurveTo(x0 + 2 * side, yb + (hy - yb) * 0.6, hx, hy);
        ctx.quadraticCurveTo(x0 + 12 - 3 * side, yb + (hy - yb) * 0.35, x0 + 12, yb);
        ctx.closePath();
      });
    }
    const trace = () => { ctx.beginPath(); for (const f of shapes) f(); };
    ctx.strokeStyle = line; ctx.lineWidth = 2.6; trace(); ctx.stroke();
    // filled one by one: pieces drawn in opposite directions would cancel where they overlap
    ctx.fillStyle = fill; for (const f of shapes) { ctx.beginPath(); f(); ctx.fill(); }

    // the words: typed out for speech, all at once for thoughts; the newest letter hops in
    ctx.fillStyle = ink; ctx.textBaseline = 'middle';
    const tx = bx + (w - full) / 2, ty = by + h / 2 + 0.5;
    if (thought) ctx.fillText(bubble.text, tx, ty);
    else {
      const k = age * 30, n = Math.min(bubble.text.length, Math.max(1, Math.floor(k)));
      const settled = bubble.text.slice(0, n - 1), last = bubble.text[n - 1];
      const rise = n < bubble.text.length || k < bubble.text.length + 1 ? (1 - (k % 1)) * 3 : 0;
      ctx.fillText(settled, tx, ty);
      ctx.fillText(last, tx + ctx.measureText(settled).width, ty - rise);
    }
    ctx.restore();
  }

  // ───────────────────────────── the loop ─────────────────────────────
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    const now = ms / 1000;
    let dt = last ? Math.min(now - last, 0.08) : 0;
    last = now;
    if (now > colourAt) { readColours(); colourAt = now + 1; }
    if (ptr.x != null && now - ptr.moved > 0.12) ptr.vx = ptr.vy = 0;
    for (let i = later.length - 1; i >= 0; i--) if (later[i].at <= now) later.splice(i, 1)[0].fn();
    if (parcels.length) {
      for (const q of parcels) if (!q.fall && !q.landed && now - q.since >= q.dur) { q.landed = true; q.then?.(); }
      parcels = parcels.filter(q => q.fall ? now - q.since < 0.9 : !q.landed);
    }
    if (flip && now - flip.since > (flip.dur || FLIP_TIME)) { flip = null; squash(0.4); jelly(3); S.happy.v = 1; }
    if (!arrived) { arrived = true; S.sc.v = 0.05; jelly(4); }
    const tg = think(now, dt);
    if (tg.mode !== prevMode) {
      const line = ON_ENTER[tg.mode];
      if (line && !(BUN && tg.mode === 'flee')) say(line[0], { chance: line[1], force: line[2] });   // a bunny's fright is a thump, not a word
      else if (prevMode === 'thrown' || ((prevMode === 'carry' || prevMode === 'trance') && tg.mode !== 'thrown' && tg.mode !== 'trance' && tg.mode !== 'flee')) say('land', { chance: 0.7, force: true });
      if (prevMode === 'pet') afterPet();
      if (prevMode === 'pounce') { say('gotcha', { chance: 0.7, force: true }); squash(0.35); }
      prevMode = tg.mode;
    }
    setTargets(tg, now);
    while (dt > 0) { const h = Math.min(dt, 1 / 120); t += h; physics(tg, h); dt -= h; }
    ptr.over = ptr.x != null && Math.hypot(ptr.x - p.x, ptr.y - p.y + hop) < R * S.sc.v * 1.5 + 6;
    canvas.dataset.over = ptr.over && !carried ? '1' : '';
    document.body.style.cursor = carried ? 'grabbing' : ptr.over ? 'grab' : '';
    draw();
  }

  // ───────────────────────────── its own senses ─────────────────────────────
  const offs = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
  function resize() { const dpr = devicePixelRatio || 1; canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; }
  on(window, 'resize', resize); resize();

  const samples = [];
  on(window, 'pointermove', e => {
    const now = nowS();
    samples.push({ x: e.clientX, y: e.clientY, t: now }); if (samples.length > 6) samples.shift();
    const a = samples[0], b = samples[samples.length - 1], span = Math.max(0.016, b.t - a.t);
    ptr.vx = (b.x - a.x) / span; ptr.vy = (b.y - a.y) / span;
    const wasOver = ptr.over;
    const mx = e.clientX - (ptr.x ?? e.clientX);
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = now;
    if (!wasOver) ptr.overSince = now;
    exit = null;

    // circling near it: two full loops of the pointer inside a few seconds and it
    // gets dizzy. Measured from the pointer's own heading, not the angle around
    // the creature, because it tends to follow you round while you do it.
    const my = e.clientY - (samples.length > 1 ? samples[samples.length - 2].y : e.clientY);
    const cd = Math.hypot(ptr.x - p.x, ptr.y - p.y);
    if (!carried && cd < 200 && Math.hypot(mx, my) > 2) {
      const heading = Math.atan2(my, mx);
      if (circling.a == null || now - circling.since > 3.5) { circling.turned = 0; circling.since = now; }
      else { let da = heading - circling.a; da -= TAU * Math.round(da / TAU); circling.turned += da; }
      circling.a = heading;
      if (Math.abs(circling.turned) > 2 * TAU && now > dizzyUntil) {
        dizzyUntil = now + 2.8; circling.a = null; jelly(4, 3); attended = null; touch();
      }
    } else if (cd >= 200) circling.a = null;

    // scrubbing back and forth across it: tickles
    if (ptr.over && !carried && Math.abs(mx) > 2) {
      const dir = Math.sign(mx);
      if (wiggle.dir && dir !== wiggle.dir) wiggle.flips.push(now);
      wiggle.dir = dir;
      wiggle.flips = wiggle.flips.filter(t0 => now - t0 < 0.9);
      if (wiggle.flips.length >= 5 && now > giggleUntil) { giggleUntil = now + 1.5; wiggle.flips = []; jump(70); }
    }
    touch();
    if (carried) e.preventDefault();
  }, { passive: false });
  on(document.documentElement, 'mouseleave', () => {
    if (ptr.x != null) exit = { x: ptr.x, y: ptr.y, t: nowS() };
    if (BUN && !act && !carried) startAct('periscope', 1.6);   // where did it go?
    ptr.x = null; ptr.vx = ptr.vy = 0; ptr.over = false;   // or the next frame thinks it is still being petted
  });
  on(window, 'pointerdown', e => {
    touch();
    if (!ptr.over || e.button !== 0 || flip) return;
    e.preventDefault(); swallowClick = true;
    if (block) { shoo(); return; }
    carried = { dx: e.clientX - p.x, dy: e.clientY - p.y, at: nowS(), x: e.clientX, y: e.clientY };
    if (!packing) dropParcel();
    document.body.style.userSelect = 'none';
    jelly(3); S.lid.vel += 12;
    attended = null; inspect = null;
  });
  on(window, 'pointerup', e => {
    if (!carried) return;
    const tap = nowS() - carried.at < 0.25 && Math.hypot(e.clientX - carried.x, e.clientY - carried.y) < 6;
    const tranced = BUN && nowS() - carried.at > 1.1;
    carried = null;
    if (tranced) {                                // down at last: it bolts and complains
      document.body.style.userSelect = '';
      const dir = p.x < innerWidth / 2 ? 1 : -1, now = nowS();
      fleeTo = { x: clamp(p.x + dir * 140, R + 8, innerWidth - R - 8), y: p.y };
      fleeUntil = now + 0.8; waryUntil = now + 4; S.scared.v = 1;
      thump();
      later.push({ at: now + 0.7, fn: () => say('eep', { force: true }) });
      return;
    }
    if (tap) {                                    // just a boop
      document.body.style.userSelect = '';
      v.x = v.y = 0; squash(0.25); jelly(2); S.happy.v = Math.max(S.happy.v, 0.6);
      return;
    }
    document.body.style.userSelect = '';
    const sp = Math.hypot(ptr.vx, ptr.vy);
    if (sp > 500) { v.x = ptr.vx * 0.9; v.y = ptr.vy * 0.9; thrownUntil = nowS() + 1.6; S.scared.v = 0.8; }
    else { v.x = v.y = 0; squash(0.7); jelly(5); S.happy.v = 0.6; }
    const a = document.elementFromPoint(p.x, p.y)?.closest?.('a');
    if (a && sp < 500) api.attend(a, a.dataset.gesture);
  });
  on(window, 'click', e => { if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
  // clicks on it pass through the canvas to the page, so stop them selecting the
  // text underneath (double and triple clicks select words and paragraphs)
  on(window, 'mousedown', e => { if (ptr.over) e.preventDefault(); });
  on(window, 'dblclick', e => {
    if (!ptr.over || reducedMotion) return;
    e.preventDefault();
    if (flip) return;
    carried = null; document.body.style.userSelect = '';   // the clicks may have picked it up; let go for the trick
    flip = { since: nowS(), dir: Math.random() < 0.5 ? -1 : 1, x: p.x, y: p.y };
    S.tilt.v = S.tilt.vel = 0;
    jump(240); S.happy.v = 1; say('flip', { force: true });
  });

  readColours();
  if (reducedMotion) { arrived = true; draw(); }
  else raf = requestAnimationFrame(frame);

  // the page under it changed: forget what belonged to the old one
  function forgetPage() {
    attended = null; reading = null; block = null; inspect = null; glance = null; tending = null;
    hoarding = null; eating = null; refuse = null; act = null; crumbs = []; bits = []; germs = []; fight = null;
    afterAttend = 0; exit = null;
    courier = null; catching = null; packing = null; parcel = false; parcels = [];
  }

  const api = {
    attend(el, gesture = 'point') {
      if (reducedMotion || attended?.el === el) return;
      if (CAT && (gesture || 'point') === 'point' && Math.random() < 0.45) {
        glance = { el, until: nowS() + 1.6 }; say('meh', { chance: 0.35 });
        return;
      }
      act = null;
      attended = { el, gesture: gesture || 'point', since: nowS() };
      touch(); inspect = null; wanderUntil = 0;
      const g = gesture || 'point';
      say(g === 'point' ? 'look' : g, { chance: g === 'point' ? 0.35 : 0.85 });
      setTimeout(() => { if (attended?.el === el) jelly(2); }, 160);   // the stroke lands
    },
    release(el) {
      if (!el || attended?.el === el) { attended = null; afterAttend = nowS() + 1.1; }
    },
    beat() { if (reducedMotion) return; jump(120); jelly(1.5); S.arms[0][1].vel += 6; touch(); },
    nod() { if (reducedMotion || asleep) return; v.y += 60; S.sy.vel -= 1.5; },
    shift() { if (reducedMotion) return; touch(); jump(180); S.tilt.vel += 8; },
    wave(seconds = 1.5) { api.do('wave', seconds); say('hello', { force: true }); },
    do(name, seconds = 1.5) { if (reducedMotion || !G[name]) return; touch(); fidget = { name, since: nowS(), until: nowS() + seconds }; },
    cheer() { if (reducedMotion) return; say('cheer', { force: true }); jump(200); S.happy.v = 1; S.arms[0][0].vel -= 25; S.arms[1][0].vel += 25; },
    // one of its words (hello, cheer, look, babble...) or any text you like
    say(what, opts = {}) {
      if (!what) return;
      if (WORDS[what] || what === 'babble') say(what, { force: true, ...opts });
      else say('look', { force: true, ...opts, text: String(what) });
    },
    feed(pageX, pageY) { if (crumbs.length < 5) crumbs.push({ x: pageX, y: pageY, born: nowS(), rot: rnd(-0.35, 0.35) }); },
    scroll(dy) {
      if (reducedMotion) return;
      touch();
      wind = clamp(wind + dy * 0.004, -0.6, 0.6);
      p.y = clamp(p.y - dy * 0.12, R, innerHeight - R);
      jelly(Math.min(2, Math.abs(dy) * 0.03), 3);
    },
    // read along: rect() returns where the text is (or null when there is none)
    read(rect, text = '') {
      if (reducedMotion) return;
      if (!rect) { reading = null; return; }
      touch();
      if (!reading) reading = { rect, text, since: nowS(), changedAt: nowS(), line: 0, reacted: false };
      else {
        reading.rect = rect;
        if (text !== reading.text) { reading.text = text; reading.changedAt = nowS(); reading.reacted = false; }
      }
    },
    sleep() { if (!asleep) { asleep = true; nextZ = nowS() + 0.5; } },
    wake() { touch(); },
    get hovered() { return ptr.over; },
    get active() { return active; },
    // too taken up with something else to go tidying
    get busy() { return asleep || !!carried || !!eating || !!reading || !!tending || !!hoarding || nowS() < fleeUntil || !!flip || !!fight || germs.length > 0 || !!courier || !!catching || !!packing; },
    // a carrot virus pops out of the page at (fromX, fromY) and heads for (x, y) to chew on it.
    // x values are client x, y values page y
    germ(x, y, fromX = x, fromY = y - R) {
      if (reducedMotion || !active) return;
      germs.push({ x: fromX, y: fromY, tx: x, ty: y, born: nowS(), state: 'walk', face: Math.sign(x - fromX) || 1 });
      for (let i = 0; i < 6; i++) bits.push({ x: fromX + rnd(-6, 6), y: fromY - scrollY + rnd(-4, 4), vx: rnd(-80, 80), vy: rnd(-140, -40), t: nowS(), col: i % 2 ? '#F28C28' : ink, r: rnd(0.8, 1.8) });
    },
    // something on the page has gone crooked: notice it after a moment, go
    // over, nudge it, and call done() at the moment it should spring back
    fix(el, done) {
      if (reducedMotion || !active) { done(); return; }
      if (tending && !tending.fixed) tending.done();
      tending = { el, done, since: nowS(), noticeAt: nowS() + rnd(0.7, 1.4), said: false, at: 0, fixed: false };
    },
    // Courier work. job is { from, to, mine, state, pace, onDrop }: from() and
    // to() return the rects it carries between (null while they are not on the
    // page), mine says which end is the visitor's own ('from' or 'to'), state()
    // is 'wait' | 'go' | 'stuck' | 'idle' (see runCourier), pace() is 0..1 for
    // how fast things are going, and onDrop() is called as each parcel goes in.
    // courier(null) stops; a parcel already on its way is delivered first.
    courier(job) {
      if (reducedMotion) return;
      if (!job) {
        if (!courier) return;
        if (parcel && courier.leg === 'carry') courier.ending = true;
        else { poof(); courier = null; }
        return;
      }
      touch();
      courier = { job, leg: 'fetch', st: null, since: nowS(), busyUntil: 0, pending: false, trips: 0 };
    },
    get courierJob() { return courier?.job ?? null; },
    // something is about to be dropped on rect(): it gets ready to catch it
    expect(rect) { catching = reducedMotion ? null : rect || null; if (rect) touch(); },
    // it wraps up a parcel and puts it on its head
    pack() { if (reducedMotion || !active) return; touch(); packing = { since: nowS() }; parcel = true; jelly(2); },
    // a delivery landed: confetti, and a flip if its hands are free
    delivered() {
      if (reducedMotion || !active) return;
      touch();
      for (let i = 0; i < 16; i++) bits.push({ x: p.x + rnd(-R, R), y: p.y - R, vx: rnd(-200, 200), vy: rnd(-380, -160), t: nowS(), col: pick(['#E9476B', '#5CCB78', '#F2C14E', '#7FB8F0', fg]), r: rnd(1.2, 2.4) });
      say('delivered', { force: true });
      S.happy.v = 1;
      if (!flip && !carried && !parcel) { flip = { since: nowS(), dir: Math.random() < 0.5 ? -1 : 1, x: p.x, y: p.y }; S.tilt.v = S.tilt.vel = 0; jump(240); }
      else jump(150);
    },
    // where it lives, px from the left edge; it walks there rather than jumping
    setMargin(x) { if (Number.isFinite(x)) MARGIN = x; },
    setFont(f) { font = f || null; fontFamily = font || getComputedStyle(document.body).fontFamily; },
    // hide it and stop animating (a page it should not be on), or bring it back
    setActive(on) {
      if (on === active) return;
      active = on;
      if (!on) {
        cancelAnimationFrame(raf); raf = 0;
        forgetPage(); bubble = null; carried = null; ptr.over = false;
        document.body.style.cursor = ''; document.body.style.userSelect = '';
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
      } else {
        canvas.style.display = '';
        p.x = MARGIN; p.y = innerHeight * 0.4; v.x = v.y = 0;
        tip.x = p.x; tip.y = p.y - R * 1.8; tip.vx = tip.vy = 0;
        readColours(); last = 0;
        if (reducedMotion) draw(); else raf = requestAnimationFrame(frame);
      }
    },
    // a new page is up: clear what belonged to the old one and walk to the new margin
    newPage() { forgetPage(); readColours(); },
    get fullness() { return full; },
    destroy() {
      cancelAnimationFrame(raf);
      for (const off of offs) off();
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      if (own) canvas.remove(); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
  return api;
}

// Wires a creature to an ordinary page. Returns a function that unbinds everything.
export function bindPage(pet, root = document, {
  linkSelector = 'a[href], [data-gesture]',
  beatSelector = 'em, strong, mark, [data-beat]',
  topicSelector = 'h1, h2, h3, [data-topic]',
  readingLine = 0.42,       // fraction of the viewport height where a line is "being read"
  crumbs = true,            // clicking blank space drops a crumb
  blankExclude = 'a, p, h1, h2, h3, li, button, input, textarea, select, label, footer, nav, [data-no-crumb]',
  greetOnLoad = true,
  tidy = true,              // now and then something slips crooked and the creature puts it straight
  germs = true,             // now and then a carrot virus turns up and gets chased off in a fight
  tidySelector = 'a, em, strong, i, b, code, h2, h3, h4, li, img, .art-stat',
} = {}) {
  const offs = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
  const inRoot = el => el && (root === document || root.contains(el));

  // deictics on hover, with the gesture the element names; beats on stressed words
  on(root, 'pointerover', e => {
    const a = e.target.closest?.(linkSelector);
    if (inRoot(a)) { pet.attend(a, a.dataset.gesture); return; }
    if (inRoot(e.target.closest?.(beatSelector))) pet.beat();
  });
  on(root, 'pointerout', e => {
    const a = e.target.closest?.(linkSelector);
    if (inRoot(a) && !a.contains(e.relatedTarget)) pet.release(a);
  });
  // leaving through a link: a cheer and a wave; blank space: a crumb
  on(root, 'click', e => {
    if (pet.hovered) return;
    const a = e.target.closest?.('a[href]');
    if (inRoot(a)) { pet.cheer(); return; }
    if (crumbs && e.button === 0 && !e.target.closest(blankExclude)) pet.feed(e.clientX, e.clientY + scrollY);
  });

  // scrolling: beats as stressed words pass the reading line, a shift at a heading, a nod when you pause
  let prevY = scrollY, scrolled = 0, stopTimer = 0, scrollRaf = 0;
  const crossed = (el, dy, line) => { const r = el.getBoundingClientRect(); if (!r.height) return false; const cur = r.top + r.height / 2 - line, prev = cur + dy; return prev * cur <= 0 && prev !== cur; };
  on(window, 'scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const dy = scrollY - prevY; prevY = scrollY;
      if (!dy) return;
      pet.scroll(dy);
      scrolled += Math.abs(dy);
      readDist += Math.abs(dy);
      const line = innerHeight * readingLine - Math.sign(dy) * 14;   // the stroke lands just before the word
      for (const el of root.querySelectorAll(beatSelector)) if (crossed(el, dy, line)) { pet.beat(); break; }
      for (const el of root.querySelectorAll(topicSelector)) if (crossed(el, dy, innerHeight * readingLine)) { pet.shift(); break; }
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => { if (scrolled > 90) pet.nod(); scrolled = 0; }, 380);
    });
  }, { passive: true });

  // selecting text: it comes and reads along, from the start of the selection
  on(document, 'selectionchange', () => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !inRoot(sel.anchorNode?.parentElement)) { pet.read(null); return; }
    const block = sel.anchorNode.parentElement.closest('p, li, blockquote, pre, h1, h2, h3, h4, dd, td') || sel.anchorNode.parentElement;
    const text = sel.toString();
    pet.read(() => {
      if (!sel.rangeCount || sel.isCollapsed) return null;
      // measure from the first visible character: a selection that starts in the
      // whitespace between lines would otherwise put its first box on the line before
      const range = sel.getRangeAt(0).cloneRange(), n = range.startContainer;
      if (n.nodeType === 3) {
        let i = range.startOffset;
        while (i < n.length && /\s/.test(n.data[i]) && (n !== range.endContainer || i < range.endOffset - 1)) i++;
        range.setStart(n, i);
      }
      const r = [...range.getClientRects()].find(b => b.width > 1);
      return r ? { left: r.left, top: r.top, width: r.width, height: r.height, gutter: block.getBoundingClientRect().left } : null;
    }, text);
  });

  // a hidden tab puts it to sleep; coming back after a while gets a hello
  let hiddenAt = 0, welcome = 0;
  on(document, 'visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); pet.sleep(); return; }
    pet.wake();
    if (hiddenAt && performance.now() - hiddenAt > 8000) welcome = setTimeout(() => { pet.cheer(); pet.wave(1.4); }, 450);
  });

  const still = matchMedia('(prefers-reduced-motion: reduce)');

  // Something on the page comes loose: a link, a word, a heading slips a few
  // degrees crooked, as if it had come off its line. The creature notices,
  // goes over and nudges it, and it springs back.
  const inView = () => [...root.querySelectorAll(tidySelector)].filter(el => {
    if (el.dataset.crooked || el.closest('[data-no-tidy]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 12 && r.width < 420 && r.height > 8 && r.height < 70 && r.top > innerHeight * 0.15 && r.bottom < innerHeight * 0.85;
  });
  function tidyOnce() {
    const candidates = inView();
    if (!candidates.length) return false;
    const el = candidates[Math.random() * candidates.length | 0];
    const saved = el.getAttribute('style');
    el.dataset.crooked = '1';
    if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';   // inline boxes can't rotate
    const deg = (Math.random() < 0.5 ? -1 : 1) * rnd(4, 8);
    el.style.transformOrigin = deg > 0 ? 'left bottom' : 'right bottom';                // it sags from one end
    el.style.transition = 'transform 0.6s cubic-bezier(0.3, 1.5, 0.6, 1)';
    requestAnimationFrame(() => { el.style.transform = `rotate(${deg.toFixed(1)}deg) translateY(1px)`; });
    pet.fix(el, () => {
      el.style.transition = 'transform 0.4s cubic-bezier(0.2, 1.8, 0.4, 1)';         // back with a little overshoot
      el.style.transform = 'rotate(0deg)';
      setTimeout(() => {
        if (saved == null) el.removeAttribute('style'); else el.setAttribute('style', saved);
        delete el.dataset.crooked;
        if (el.getAttribute('style') === '') el.removeAttribute('style');      // leave it exactly as it was
      }, 450);
    });
    return true;
  }

  // A carrot virus pops out of the page beside a word and starts chewing it.
  function germOnce() {
    if (!pet.germ) return false;
    // a word-sized thing in view, or failing that a spot on the first line of a paragraph
    const candidates = inView();
    const lines = [...root.querySelectorAll('p')].map(el => el.getBoundingClientRect())
      .filter(r => r.top > innerHeight * 0.15 && r.top < innerHeight * 0.8 && r.width > 60)
      .map(r => ({ left: r.left, top: r.top, width: Math.min(r.width, 480), height: 22 }));
    const all = [...candidates.map(el => el.getBoundingClientRect()), ...lines];
    if (!all.length) return false;
    const r = all[Math.random() * all.length | 0];
    const x = r.left + r.width * rnd(0.2, 0.8), y = r.top + r.height * 0.5 + scrollY;
    pet.germ(x, y, x + rnd(-70, 70), y - rnd(10, 40));
    return true;
  }

  // When things happen. Not on a clock: people don't sit idle on a page, they
  // read it. On a long page an event comes every 1.3 screens or so of reading
  // (at least 14 s apart), or after 25 s of reading without scrolling far. On a
  // short page, the first comes 12-20 s in and then every 30-50 s. Only time
  // when you are actually there counts (a move, a scroll or a key in the last
  // 6 s), never on a hidden tab, never with reduced motion, never while the
  // creature is busy.
  let readDist = 0, engagedMs = 0, lastEngaged = performance.now(), lastEvent = performance.now(), lastTick = performance.now();
  let shortGap = rnd(12, 20) * 1000;
  const engage = () => { lastEngaged = performance.now(); };
  on(window, 'pointermove', engage, { passive: true });
  on(window, 'keydown', engage);
  on(window, 'scroll', () => { engage(); }, { passive: true });
  const director = (tidy || germs) ? setInterval(() => {
    const now = performance.now(), dt = now - lastTick;
    lastTick = now;
    if (document.hidden || still.matches || pet.active === false) return;
    if (now - lastEngaged < 6000) engagedMs += dt;
    const long = document.documentElement.scrollHeight > innerHeight * 2.5;
    const due = long ? (readDist > innerHeight * 1.3 && now - lastEvent > 14000) || engagedMs > 25000 : engagedMs > shortGap;
    if (!due || pet.busy) return;
    const wantGerm = germs && (!tidy || Math.random() < 0.45);
    const happened = wantGerm ? germOnce() || (tidy && tidyOnce()) : tidyOnce() || (germs && germOnce());
    if (happened) { lastEvent = now; readDist = 0; engagedMs = 0; shortGap = rnd(30, 50) * 1000; }
  }, 500) : 0;

  let hello = 0;
  if (greetOnLoad) hello = setTimeout(() => pet.wave(1.5), 700);

  return () => {
    for (const off of offs) off();
    clearTimeout(hello); clearTimeout(stopTimer); clearTimeout(welcome); clearInterval(director);
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
  };
}
