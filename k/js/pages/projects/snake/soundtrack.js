// ATMOSPHERIC SOUNDTRACK + SFX — Raga Darbari × Gothic
// A synth bed (sub, wind, tanpura drone, bass) under sampled tabla and sitar. The samples come
// from the Desi Jungle starter kit (see snake_assets/audio/SOURCES.md); when any of them is
// missing or still loading, the old chiptune voice plays in its place.
export default function createSoundtrack() {
    let ctx = null;
    let masterGain = null;
    let musicGain = null;
    let sfxGain = null;
    let running = false;
    let timers = [];
    let nodes = [];
    let volume = 0.5;

    /* ── Raga Darbari Kanada scale ─────────────────────── */
    const BASE = 130.81; // C3
    const INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12]; // Sa Re ga Ma Pa dha ni Sa'
    const freq = (idx, oct = 0) =>
        BASE * Math.pow(2, (INTERVALS[((idx % 8) + 8) % 8]) / 12 + oct);

    /* ── helpers ────────────────────────────────────────── */
    function ensureCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(ctx.destination);

            musicGain = ctx.createGain();
            musicGain.gain.value = 1;
            musicGain.connect(masterGain);

            sfxGain = ctx.createGain();
            sfxGain.gain.value = 1;
            sfxGain.connect(masterGain);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function playNote(freqVal, duration, {
        type = 'square', gain = 0.10, attack = 0.02, decay = 0.1,
        sustain = 0.6, release = 0.15, detune = 0, pan = 0,
        destination = musicGain
    } = {}) {
        const c = ensureCtx();
        const now = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.value = freqVal;
        osc.detune.value = detune;

        const peakGain = gain * volume;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peakGain, now + attack);
        g.gain.linearRampToValueAtTime(peakGain * sustain, now + attack + decay);
        g.gain.setValueAtTime(peakGain * sustain, now + duration - release);
        g.gain.linearRampToValueAtTime(0, now + duration);

        if (pan !== 0) {
            const panner = c.createStereoPanner();
            panner.pan.value = pan;
            osc.connect(g).connect(panner).connect(destination || masterGain);
        } else {
            osc.connect(g).connect(destination || masterGain);
        }

        osc.start(now);
        osc.stop(now + duration + 0.05);
        nodes.push(osc);
        return osc;
    }

    function playDrum(duration = 0.08, {
        gain = 0.10, freq: f = 800, Q = 5,
        destination = musicGain
    } = {}) {
        const c = ensureCtx();
        const now = c.currentTime;
        const bufSize = c.sampleRate * duration;
        const buf = c.createBuffer(1, bufSize, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const src = c.createBufferSource();
        src.buffer = buf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = Q;
        const g = c.createGain();
        g.gain.setValueAtTime(gain * volume, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);

        src.connect(bp).connect(g).connect(destination || masterGain);
        src.start(now);
        src.stop(now + duration + 0.01);
        nodes.push(src);
    }

    function playTom(startFreq = 150, endFreq = 60, dur = 0.15, {
        gain = 0.12, destination = musicGain
    } = {}) {
        const c = ensureCtx();
        const now = c.currentTime;
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(gain * volume, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(g).connect(destination || masterGain);
        osc.start(now);
        osc.stop(now + dur + 0.01);
        nodes.push(osc);
    }

    /* ── sample bank ───────────────────────────────────── */
    const AUDIO_BASE = 'js/pages/projects/snake/snake_assets/audio/';
    const SAMPLE_FILES = {
        ke: 'tabla_ke.wav', na: 'tabla_na.wav', tin: 'tabla_tin.wav', hi: 'tabla_hi.wav', ghe: 'tabla_ghe.wav', gheShort: 'tabla_ghe_short.wav',
        fillA: 'tabla_fill_a.wav', fillB: 'tabla_fill_b.wav', fillC: 'tabla_fill_c.wav',
        sitarMinA: 'sitar_min_a.wav', sitarMinB: 'sitar_min_b.wav', sitarMinC: 'sitar_min_c.wav', sitarMaj: 'sitar_maj.wav',
        sitarNote: 'sitar_note.wav',
    };
    const SITAR_NOTE_ROOT = 830.61;      // the GM sitar sample is a G#5
    const STRUM_TO_C = Math.pow(2, -2 / 12); // the strums are in D; the raga sits on C
    const buffers = {};
    let loading = null;
    function preload() {
        if (loading) return loading;
        const c = ensureCtx();
        loading = Promise.all(Object.entries(SAMPLE_FILES).map(([k, f]) =>
            fetch(AUDIO_BASE + f).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
                .then(ab => c.decodeAudioData(ab)).then(b => { buffers[k] = b; })
                .catch(() => { /* missing sample: the synth voice stands in */ })
        ));
        return loading;
    }
    function loadedCount() { return Object.keys(buffers).length; }

    // play a sample; returns false when it is not available so the caller can fall back
    function playSample(name, { gain = 0.5, rate = 1, pan = 0, destination = musicGain, attack = 0.002, hold = null, release = 0.08, when = 0, lpf = 0 } = {}) {
        const b = buffers[name];
        if (!b) return false;
        const c = ensureCtx();
        const now = c.currentTime + when;
        const src = c.createBufferSource();
        src.buffer = b;
        src.playbackRate.value = rate;
        const g = c.createGain();
        const peak = gain * volume;
        const length = b.duration / rate;
        const dur = hold != null ? Math.min(length, hold) : length;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak, now + attack);
        g.gain.setValueAtTime(peak, now + Math.max(attack, dur - release));
        g.gain.linearRampToValueAtTime(0, now + dur);
        let head = src;
        if (lpf) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lpf; f.Q.value = 0.5; head.connect(f); head = f; }
        if (pan !== 0) {
            const panner = c.createStereoPanner();
            panner.pan.value = pan;
            head.connect(g).connect(panner).connect(destination || masterGain);
        } else {
            head.connect(g).connect(destination || masterGain);
        }
        src.start(now);
        src.stop(now + dur + 0.05);
        nodes.push(src);
        return true;
    }

    /* ── schedule helper ───────────────────────────────── */
    function scheduleLoop(fn, interval) {
        let id;
        const loop = () => { fn(); id = setTimeout(loop, interval()); };
        id = setTimeout(loop, interval());
        timers.push(() => clearTimeout(id));
        return () => clearTimeout(id);
    }

    /* ── ATMOSPHERIC LAYERS ────────────────────────────── */

    // Sub-bass drone (very low C1 sine)
    function startSubBass() {
        const c = ensureCtx();
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 32.70; // C1
        const g = c.createGain();
        g.gain.value = 0.06 * volume;
        // slow LFO for subtle pulsing
        const lfo = c.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.15; // very slow
        const lfoGain = c.createGain();
        lfoGain.gain.value = 0.03 * volume;
        lfo.connect(lfoGain).connect(g.gain);
        osc.connect(g).connect(musicGain);
        lfo.start();
        osc.start();
        nodes.push(osc, lfo);
    }

    // Wind noise layer — filtered noise with LFO
    function startWind() {
        const c = ensureCtx();
        const bufSize = c.sampleRate * 4;
        const buf = c.createBuffer(1, bufSize, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;

        // bandpass for wind character
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 600;
        bp.Q.value = 0.8;

        // LFO modulates filter frequency for howling effect
        const lfo = c.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08;
        const lfoGain = c.createGain();
        lfoGain.gain.value = 400;
        lfo.connect(lfoGain).connect(bp.frequency);

        const g = c.createGain();
        g.gain.value = 0.035 * volume;

        src.connect(bp).connect(g).connect(musicGain);
        lfo.start();
        src.start();
        nodes.push(src, lfo);
    }

    /* ── MUSIC LOOPS ───────────────────────────────────── */

    // Tanpura drone — Sa + Pa
    function startDrone() {
        [0, 4].forEach((idx, i) => {
            const f = freq(idx, -1);
            const c = ensureCtx();
            const osc = c.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = f;
            const g = c.createGain();
            g.gain.value = 0.04 * volume;
            // tremolo
            const lfo = c.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 3.5 + i * 0.7;
            const lfoG = c.createGain();
            lfoG.gain.value = 0.015 * volume;
            lfo.connect(lfoG).connect(g.gain);
            osc.connect(g).connect(musicGain);
            lfo.start();
            osc.start();
            nodes.push(osc, lfo);
        });
    }

    // The lead voice: a breath-like tone (two close sines, a faint octave, a low-pass), with a
    // slow onset, late vibrato, meend glides between notes, and the slow andolan (a wide, slow
    // oscillation) that Darbari Kanada puts on komal ga and komal dha.
    function playLead(f, dur, { fromFreq = null, andolan = false, gain = 0.09, pan = 0 } = {}) {
        const c = ensureCtx();
        const now = c.currentTime;
        const out = c.createGain();
        const peak = gain * volume;
        out.gain.setValueAtTime(0, now);
        out.gain.linearRampToValueAtTime(peak, now + 0.14);
        out.gain.setValueAtTime(peak, now + Math.max(0.14, dur - 0.4));
        out.gain.linearRampToValueAtTime(0, now + dur);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.7;
        const voices = [[1, 'sine', 1], [1.004, 'sine', 0.55], [2, 'sine', 0.1], [1, 'triangle', 0.12]];
        const oscs = [];
        for (const [ratio, type, g] of voices) {
            const o = c.createOscillator(); o.type = type;
            const target = f * ratio;
            if (fromFreq) { o.frequency.setValueAtTime(fromFreq * ratio, now); o.frequency.exponentialRampToValueAtTime(target, now + 0.22); } // meend
            else o.frequency.setValueAtTime(target, now);
            const vg = c.createGain(); vg.gain.value = g;
            o.connect(vg).connect(lp);
            o.start(now); o.stop(now + dur + 0.05);
            oscs.push(o); nodes.push(o);
        }
        // vibrato that arrives late, as a singer's does
        const vib = c.createOscillator(); vib.frequency.value = 5.2;
        const vibG = c.createGain(); vibG.gain.setValueAtTime(0, now); vibG.gain.linearRampToValueAtTime(f * 0.004, now + 0.6);
        vib.connect(vibG); oscs.forEach(o => vibG.connect(o.frequency)); vib.start(now); vib.stop(now + dur + 0.05); nodes.push(vib);
        if (andolan) {
            // the slow swing between the note and a quarter-tone below it
            const an = c.createOscillator(); an.frequency.value = 0.55 + Math.random() * 0.25;
            const anG = c.createGain(); anG.gain.value = f * 0.016;
            an.connect(anG); oscs.forEach(o => anG.connect(o.frequency)); an.start(now); an.stop(now + dur + 0.05); nodes.push(an);
        }
        if (pan !== 0) { const pn = c.createStereoPanner(); pn.pan.value = pan; lp.connect(out).connect(pn).connect(musicGain); }
        else lp.connect(out).connect(musicGain);
    }

    // Darbari Kanada in C. Degrees: 0 Sa, 1 Re, 2 komal ga, 3 Ma, 4 Pa, 5 komal dha, 6 komal ni, 7 Sa';
    // negative degrees reach below Sa. Each note is [degree, matras]. These are the raga's own
    // characteristic phrases (its pakad), not a tune: Re is where it rests, Pa answers it, the komal
    // notes are leaned on slowly, and the descent S' d n P, M P g M R S is its signature.
    const PHRASES = [
        [[-1, 1], [0, 2], [1, 4]],
        [[1, 1.5], [1, 1], [0, 4]],
        [[0, 1], [1, 1], [2, 3], [3, 1], [1, 1.5], [0, 4]],
        [[3, 1], [4, 2], [5, 3], [6, 1], [7, 4]],
        [[7, 2], [5, 3], [6, 1], [4, 4]],
        [[3, 1], [4, 1.5], [2, 3], [3, 1], [1, 2], [0, 5]],
        [[5, 3], [6, 1], [4, 4]],
        [[-2, 2], [-1, 1], [0, 3], [1, 2], [0, 4]],
        [[4, 2], [5, 2.5], [4, 1], [3, 1], [1, 2], [0, 3]],
        [[6, 1], [7, 3], [1, 2], [0, 4]],
    ];
    // which phrase tends to follow which: a loose grammar, so it does not loop
    const NEXT = [[1, 2, 7], [2, 3, 8], [3, 5, 6], [4, 9], [5, 6, 7], [0, 1, 7], [1, 5, 8], [2, 3, 0], [0, 7, 6], [5, 4, 2]];
    const KOMAL = new Set([2, 5, -2]);
    const MATRA_MS = 430;

    function startMelody() {
        let phrase = 0;
        const run = () => {
            if (!running) return;
            const notes = PHRASES[phrase];
            let t = 0, prevF = null;
            notes.forEach(([deg, m], i) => {
                const dur = m * MATRA_MS / 1000;
                const f = freq(deg, 1); // Sa = C4: a voice, not a bass
                const last = i === notes.length - 1;
                const glide = prevF && Math.abs(deg - notes[i - 1][0]) <= 2 ? prevF : null;
                const delay = t;
                setTimeout(() => {
                    if (!running) return;
                    playLead(f, dur + 0.25, { fromFreq: glide, andolan: KOMAL.has(deg) && m >= 2, pan: Math.sin(deg) * 0.25 });
                    // a grace of komal Re under Sa: a note the raga does not own, so it stings, quietly
                    if (deg === 0 && m >= 3 && Math.random() < 0.3) playNote(f * Math.pow(2, 1 / 12), 0.5, { type: 'sine', gain: 0.022, attack: 0.3, sustain: 0.5, release: 0.2, destination: musicGain });
                    // a shadow a fifth below, late and faint
                    if (Math.random() < 0.3) setTimeout(() => running && playNote(f / 1.5, dur * 0.6, { type: 'sine', gain: 0.018, attack: 0.25, sustain: 0.5, release: 0.4, pan: -0.5, destination: musicGain }), 320);
                    // the sitar answers the end of a phrase now and then, softened and far away
                    if (last && Math.random() < 0.35) playSample('sitarNote', { gain: 0.16, rate: (f * 2) / SITAR_NOTE_ROOT, pan: 0.45, release: 0.6, lpf: 1800, destination: musicGain, when: 0.12 });
                }, delay);
                t += dur * 1000;
                prevF = f;
            });
            const options = NEXT[phrase];
            phrase = options[Math.floor(Math.random() * options.length)];
            // breathing: a short rest, or sometimes a long silence over the drone
            const rest = Math.random() < 0.25 ? (8 + Math.random() * 6) * MATRA_MS : (2 + Math.random() * 4) * MATRA_MS;
            const id = setTimeout(run, t + rest);
            timers.push(() => clearTimeout(id));
        };
        const id = setTimeout(run, 2500);
        timers.push(() => clearTimeout(id));
    }

    // Tabla — Teentaal, sixteen matras, played slow and heavy on the sampled drums.
    //   Dha Dhin Dhin Dha | Dha Dhin Dhin Dha | Dha Tin Tin Ta | Ta Dhin Dhin Dha
    // Dha = bayan + na, Dhin = bayan + tin, Tin = tin, Ta = na. The synth hits stand in if the
    // samples are not there.
    function startTabla() {
        const THEKA = ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'];
        const BOL = {
            Dha:  () => { playSample('gheShort', { gain: 0.6, rate: 0.95, destination: musicGain }); return playSample('na', { gain: 0.5, pan: 0.15, destination: musicGain }); },
            Dhin: () => { playSample('ghe', { gain: 0.5, rate: 0.95, hold: 0.6, release: 0.3, destination: musicGain }); return playSample('tin', { gain: 0.42, pan: 0.2, destination: musicGain }); },
            Tin:  () => playSample('tin', { gain: 0.42, pan: 0.2, destination: musicGain }),
            Ta:   () => playSample('na', { gain: 0.46, pan: 0.15, destination: musicGain }),
        };
        const FILLS = ['fillA', 'fillB', 'fillC'];
        let step = 0;
        const MATRA = 430; // ms per matra: slow, a funeral walk, not a dance

        let silentCycle = false;
        scheduleLoop(() => {
            const bol = THEKA[step];
            const sam = step === 0;
            if (sam) silentCycle = Math.random() < 0.12;
            if (silentCycle) { step = (step + 1) % THEKA.length; return; }
            // a fill in the last two matras of every fourth cycle or so
            if (step === 14 && Math.random() < 0.25 && playSample(FILLS[Math.floor(Math.random() * FILLS.length)], { gain: 0.5, rate: 1.0, pan: -0.1, destination: musicGain })) {
                step = 0; // the fill covers matras 15 and 16
                return;
            }
            const ok = BOL[bol]();
            if (!ok) {
                // chiptune stand-in
                if (bol === 'Dha' || bol === 'Dhin') playTom(180, 70, 0.18, { gain: 0.08, destination: musicGain });
                else playDrum(0.07, { gain: 0.06, freq: 600 + Math.random() * 400, destination: musicGain });
            } else if (sam) {
                // the sam lands with a little more weight
                playTom(90, 40, 0.25, { gain: 0.05, destination: musicGain });
            }
            step = (step + 1) % THEKA.length;
        }, () => MATRA + (Math.random() - 0.5) * 24);
    }

    // Bass line on Sa-Pa-Ma-ga — very slow
    function startBass() {
        const bassNotes = [0, 4, 3, 2];
        let bi = 0;
        const BASS_TEMPO = 1600;

        scheduleLoop(() => {
            playNote(freq(bassNotes[bi], -1), 1.2, {
                type: 'triangle',
                gain: 0.08,
                attack: 0.05,
                sustain: 0.7,
                release: 0.3,
                destination: musicGain
            });
            bi = (bi + 1) % bassNotes.length;
        }, () => BASS_TEMPO + Math.random() * 200);
    }

    // A sitar strum now and then: the D minor strums of the kit, brought down to C, where the raga lives.
    // Falls back to the old square arpeggio without the samples.
    function startArpeggio() {
        const STRUMS = ['sitarMinA', 'sitarMinB', 'sitarMinC'];
        const INTERVAL = 22000;
        scheduleLoop(() => {
            const pan = Math.random() * 0.8 - 0.4;
            if (playSample(STRUMS[Math.floor(Math.random() * STRUMS.length)], { gain: 0.26, rate: STRUM_TO_C * (Math.random() < 0.4 ? 0.5 : 1), pan, release: 2, lpf: 2400, destination: musicGain })) return;
            const root = [0, 3, 5, 7][Math.floor(Math.random() * 4)];
            const chord = [0, 3, 5];
            chord.forEach((offset, i) => {
                setTimeout(() => {
                    playNote(freq(root + offset, 1), 0.5, {
                        type: 'square', gain: 0.04, attack: 0.03, sustain: 0.3, release: 0.2,
                        pan: -0.5 + i * 0.5, destination: musicGain
                    });
                }, i * 140);
            });
        }, () => INTERVAL + Math.random() * 14000);
    }

    /* ── SFX FUNCTIONS ─────────────────────────────────── */

    function sfxEat() {
        const c = ensureCtx();
        playSample('tin', { gain: 0.22, rate: 1.15 + Math.random() * 0.1, pan: 0.1, destination: sfxGain });
        // ascending chime: Pa → dha → Sa'
        const notes = [freq(4, 1), freq(5, 1), freq(0, 2)];
        notes.forEach((f, i) => {
            setTimeout(() => {
                playNote(f, 0.18, {
                    type: 'sine',
                    gain: 0.14,
                    attack: 0.01,
                    decay: 0.04,
                    sustain: 0.3,
                    release: 0.08,
                    detune: i * 3,
                    destination: sfxGain
                });
            }, i * 60);
        });
        // sparkle noise
        setTimeout(() => {
            playDrum(0.04, { gain: 0.05, freq: 3000, Q: 2, destination: sfxGain });
        }, 180);
    }

    function sfxDie() {
        const c = ensureCtx();
        // descending dissonant crash
        const notes = [freq(7, 1), freq(6, 1), freq(5, 0), freq(2, 0)];
        notes.forEach((f, i) => {
            setTimeout(() => {
                playNote(f, 0.3, {
                    type: 'sawtooth',
                    gain: 0.12,
                    attack: 0.01,
                    sustain: 0.5,
                    release: 0.15,
                    detune: -20 + i * 10,
                    destination: sfxGain
                });
            }, i * 80);
        });
        // thud
        setTimeout(() => {
            playTom(120, 30, 0.25, { gain: 0.15, destination: sfxGain });
        }, 100);
        // noise crunch
        setTimeout(() => {
            playDrum(0.15, { gain: 0.10, freq: 400, Q: 1, destination: sfxGain });
        }, 200);
    }

    function sfxGameOver() {
        const c = ensureCtx();
        // slow mournful descending phrase
        const phrase = [freq(7, 1), freq(5, 1), freq(4, 1), freq(3, 1),
                        freq(2, 0), freq(0, 0), freq(-1, 0)];
        phrase.forEach((f, i) => {
            setTimeout(() => {
                playNote(f, 0.6, {
                    type: 'square',
                    gain: 0.09,
                    attack: 0.05,
                    sustain: 0.5,
                    release: 0.3,
                    detune: -10,
                    destination: sfxGain
                });
            }, i * 250);
        });
        // deep rumble
        setTimeout(() => {
            playTom(60, 20, 0.5, { gain: 0.14, destination: sfxGain });
        }, 300);
        // dissonant held chord at end
        setTimeout(() => {
            [freq(0, 0), freq(1, 0), freq(6, 0)].forEach(f => {
                playNote(f, 1.5, {
                    type: 'sawtooth',
                    gain: 0.05,
                    attack: 0.1,
                    sustain: 0.6,
                    release: 0.5,
                    destination: sfxGain
                });
            });
        }, phrase.length * 250);
    }

    function sfxGameStart() {
        const c = ensureCtx();
        // ascending awakening motif
        const awakening = [freq(0, 0), freq(2, 0), freq(4, 0),
                           freq(5, 0), freq(7, 0), freq(0, 1)];
        awakening.forEach((f, i) => {
            setTimeout(() => {
                playNote(f, 0.25, {
                    type: 'square',
                    gain: 0.10,
                    attack: 0.02,
                    sustain: 0.4,
                    release: 0.12,
                    detune: 5,
                    destination: sfxGain
                });
            }, i * 100);
        });
        // high Sa shimmer
        setTimeout(() => {
            playNote(freq(0, 2), 0.8, {
                type: 'sine',
                gain: 0.07,
                attack: 0.1,
                sustain: 0.3,
                release: 0.4,
                destination: sfxGain
            });
        }, awakening.length * 100);
        // tabla flourish
        setTimeout(() => {
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    playDrum(0.05, {
                        gain: 0.06, freq: 800 + i * 200,
                        destination: sfxGain
                    });
                }, i * 50);
            }
        }, 200);
    }

    function sfxRespawn() {
        const c = ensureCtx();
        // minor chord stab
        [freq(0, 0), freq(2, 0), freq(3, 0)].forEach(f => {
            playNote(f, 0.3, {
                type: 'triangle',
                gain: 0.09,
                attack: 0.01,
                sustain: 0.4,
                release: 0.15,
                destination: sfxGain
            });
        });
        // rising recovery
        setTimeout(() => {
            [freq(0, 0), freq(2, 0), freq(4, 0)].forEach((f, i) => {
                setTimeout(() => {
                    playNote(f, 0.2, {
                        type: 'sine',
                        gain: 0.08,
                        attack: 0.02,
                        sustain: 0.3,
                        release: 0.1,
                        destination: sfxGain
                    });
                }, i * 80);
            });
        }, 300);
    }

    function sfxBell() {
        // a struck temple bell: fundamental plus inharmonic partials, long tail
        const base = freq(0, 1);
        [[1, 0.16, 2.6], [2.41, 0.07, 1.6], [3.9, 0.04, 1.0], [5.4, 0.02, 0.6]].forEach(([ratio, g, dur]) => {
            playNote(base * ratio, dur, {
                type: 'sine', gain: g, attack: 0.005, decay: 0.3,
                sustain: 0.35, release: dur * 0.5, destination: sfxGain
            });
        });
        playDrum(0.03, { gain: 0.08, freq: 2400, Q: 1.5, destination: sfxGain });
    }

    function sfxShrine() {
        // a diya catching: soft breathy whoosh, then a warm major-ish third
        playDrum(0.25, { gain: 0.05, freq: 900, Q: 0.7, destination: sfxGain });
        [freq(0, 1), freq(2, 1), freq(4, 1)].forEach((f, i) => {
            setTimeout(() => playNote(f, 0.9, {
                type: 'triangle', gain: 0.07, attack: 0.08, sustain: 0.5,
                release: 0.4, pan: -0.2 + i * 0.2, destination: sfxGain
            }), 120 + i * 90);
        });
    }

    function sfxMemory() {
        // a memory surfacing: slow upward shimmer, bowed, with a held Sa' on top
        [freq(0, 1), freq(3, 1), freq(5, 1), freq(7, 1), freq(0, 2)].forEach((f, i) => {
            setTimeout(() => playNote(f, 1.4, {
                type: 'sine', gain: 0.07, attack: 0.25, decay: 0.2,
                sustain: 0.6, release: 0.6, detune: -4 + i * 2,
                pan: (i % 2 ? 0.35 : -0.35), destination: sfxGain
            }), i * 140);
        });
        setTimeout(() => playNote(freq(0, 3), 2.2, {
            type: 'sine', gain: 0.03, attack: 0.5, sustain: 0.6, release: 1.0, destination: sfxGain
        }), 600);
    }

    function sfxShed() {
        // skin tearing away: three dead strokes, then a dry rattling noise burst and a falling hiss
        [0, 0.06, 0.12].forEach((t, i) => playSample('ke', { gain: 0.55 - i * 0.12, rate: 1.1 + i * 0.15, pan: -0.2 + i * 0.2, when: t, destination: sfxGain }));
        for (let i = 0; i < 6; i++) {
            setTimeout(() => playDrum(0.05, {
                gain: 0.07, freq: 1800 - i * 150, Q: 3, destination: sfxGain
            }), i * 28);
        }
        playTom(900, 180, 0.35, { gain: 0.06, destination: sfxGain });
    }

    function sfxBanish() {
        // an Asura unmade: brittle crack then a low exhale
        playSample('ghe', { gain: 0.7, rate: 0.8, destination: sfxGain });
        playDrum(0.06, { gain: 0.12, freq: 1200, Q: 0.8, destination: sfxGain });
        setTimeout(() => playTom(240, 40, 0.4, { gain: 0.12, destination: sfxGain }), 40);
        setTimeout(() => playNote(freq(1, 0), 0.5, {
            type: 'sawtooth', gain: 0.05, attack: 0.02, sustain: 0.3, release: 0.3, detune: -30, destination: sfxGain
        }), 60);
    }

    function sfxAct() {
        // a chapter turning: deep gong, then a slow open fifth, with the bayan under it
        playSample('ghe', { gain: 0.8, rate: 0.55, release: 0.6, destination: sfxGain });
        playTom(90, 28, 1.2, { gain: 0.18, destination: sfxGain });
        playDrum(0.4, { gain: 0.05, freq: 300, Q: 0.6, destination: sfxGain });
        setTimeout(() => [freq(0, -1), freq(4, -1), freq(0, 0)].forEach((f, i) => playNote(f, 2.4, {
            type: 'triangle', gain: 0.07, attack: 0.4, sustain: 0.6, release: 1.0,
            pan: -0.3 + i * 0.3, destination: sfxGain
        })), 300);
    }

    function sfxLunge() {
        // the Drowned One striking: wet snap
        playSample('ke', { gain: 0.6, rate: 0.7, destination: sfxGain });
        playDrum(0.08, { gain: 0.1, freq: 500, Q: 1.2, destination: sfxGain });
        playTom(400, 90, 0.18, { gain: 0.09, destination: sfxGain });
    }

    function sfxBite() {
        // the King's fangs: a dead tabla stroke, a snap of noise and a short falling hiss
        playSample('ke', { gain: 0.7, rate: 1.4, destination: sfxGain });
        playDrum(0.04, { gain: 0.12, freq: 2600, Q: 1.2, destination: sfxGain });
        setTimeout(() => playTom(700, 160, 0.16, { gain: 0.08, destination: sfxGain }), 30);
    }

    function sfxStomp(strength) {
        // a Sentinel's footfall nearby
        playSample('ghe', { gain: 0.5 * strength, rate: 0.5, hold: 0.5, release: 0.3, pan: (Math.random() - 0.5) * 0.4, destination: sfxGain });
    }

    function sfxVictory(trueEnding) {
        // the Nagmani igniting; the true ending resolves to a major strum, the hollow one stays minor
        playSample(trueEnding ? 'sitarMaj' : 'sitarMinA', { gain: 0.6, rate: STRUM_TO_C, release: 1.5, when: 0.9, destination: sfxGain });
        const phrase = [freq(0, 0), freq(2, 0), freq(4, 0), freq(5, 0), freq(7, 0), freq(0, 1), freq(2, 1), freq(0, 2)];
        phrase.forEach((f, i) => setTimeout(() => playNote(f, 0.5, {
            type: 'triangle', gain: 0.09, attack: 0.03, sustain: 0.5, release: 0.25, destination: sfxGain
        }), i * 150));
        setTimeout(() => sfxBell(), phrase.length * 150);
        if (trueEnding) {
            setTimeout(() => playNote(freq(0, 2), 4, {
                type: 'sine', gain: 0.06, attack: 1.2, sustain: 0.7, release: 1.5, detune: 3, destination: sfxGain
            }), phrase.length * 150 + 200);
        }
    }

    /* ── TRANSPORT CONTROLS ────────────────────────────── */

    function start() {
        if (running) return;
        ensureCtx();
        preload();
        running = true;

        startSubBass();
        startWind();
        startDrone();
        startMelody();
        startTabla();
        startBass();
        startArpeggio();
    }

    function stop() {
        running = false;
        timers.forEach(fn => fn());
        timers = [];
        nodes.forEach(n => { try { n.stop(); } catch (_) {} });
        nodes = [];
        if (ctx) { ctx.close().catch(() => {}); ctx = null; masterGain = null; musicGain = null; sfxGain = null; }
        for (const k of Object.keys(buffers)) delete buffers[k];
        loading = null;
    }

    function toggle() {
        if (running) stop(); else start();
        return running;
    }

    function setVolume(v) { volume = v; if (masterGain) masterGain.gain.value = v; }
    function getVolume() { return volume; }
    function isPlaying() { return running; }

    return {
        start, stop, toggle, setVolume, getVolume, isPlaying,
        sfxEat, sfxDie, sfxGameOver, sfxGameStart, sfxRespawn,
        sfxBell, sfxShrine, sfxMemory, sfxShed, sfxBanish, sfxAct, sfxLunge, sfxVictory, sfxStomp, sfxBite,
        preload, loadedCount
    };
}
