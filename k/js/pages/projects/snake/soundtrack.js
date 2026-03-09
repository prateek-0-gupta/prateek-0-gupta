// ATMOSPHERIC CHIPTUNE SOUNDTRACK + SFX — Raga Darbari × Gothic
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

    // Melody — slower, with breathing pauses
    function startMelody() {
        const phrases = [
            [0, 2, 3, 5, 4, 3, 2, 0],
            [4, 5, 7, 5, 4, 3, 2, 3],
            [0, -1, 0, 2, 3, 5, 4, 2],
            [7, 5, 4, 3, 2, 0, -1, 0],
            [3, 4, 5, 7, 5, 4, 3, 2],
            [0, 2, 4, 5, 7, 5, 3, 0],
            [5, 4, 3, 2, 0, 2, 3, 5],
            [7, 5, 3, 2, 0, -1, 0, 2],
        ];
        let pi = 0;
        let ni = 0;
        let melodyRest = false; // breathing pause flag
        const MELODY_TEMPO = 850; // ms per note (slower)

        scheduleLoop(() => {
            if (melodyRest) {
                melodyRest = false;
                return;
            }
            const note = phrases[pi][ni];
            const oct = note >= 7 ? 1 : 0;
            playNote(freq(note, oct), 0.7, {
                type: 'square',
                gain: 0.07,
                attack: 0.04,
                sustain: 0.4,
                release: 0.25,
                detune: Math.random() * 10 - 5,
                pan: Math.random() * 0.6 - 0.3,
                destination: musicGain
            });
            ni++;
            if (ni >= phrases[pi].length) {
                ni = 0;
                pi = (pi + 1) % phrases.length;
                // 40% chance of a breathing pause between phrases
                if (Math.random() < 0.4) melodyRest = true;
            }
        }, () => MELODY_TEMPO + Math.random() * 200);
    }

    // Tabla pattern — slower
    function startTabla() {
        const pattern = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0];
        let step = 0;
        const TABLA_TEMPO = 400; // ms per step

        scheduleLoop(() => {
            if (pattern[step]) {
                if (step % 4 === 0) {
                    playTom(180, 70, 0.18, { gain: 0.08, destination: musicGain });
                } else {
                    playDrum(0.07, {
                        gain: 0.06,
                        freq: 600 + Math.random() * 400,
                        destination: musicGain
                    });
                }
            }
            step = (step + 1) % pattern.length;
        }, () => TABLA_TEMPO + Math.random() * 40);
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

    // Occasional minor arpeggio
    function startArpeggio() {
        const ARPEGG_INTERVAL = 7000;
        scheduleLoop(() => {
            const root = [0, 3, 5, 7][Math.floor(Math.random() * 4)];
            const chord = [0, 3, 5]; // minor-ish
            chord.forEach((offset, i) => {
                setTimeout(() => {
                    playNote(freq(root + offset, 1), 0.5, {
                        type: 'square',
                        gain: 0.04,
                        attack: 0.03,
                        sustain: 0.3,
                        release: 0.2,
                        pan: -0.5 + i * 0.5,
                        destination: musicGain
                    });
                }, i * 140);
            });
            // descending echo
            setTimeout(() => {
                chord.reverse().forEach((offset, i) => {
                    setTimeout(() => {
                        playNote(freq(root + offset, 1), 0.3, {
                            type: 'sine',
                            gain: 0.025,
                            sustain: 0.2,
                            pan: 0.4 - i * 0.4,
                            destination: musicGain
                        });
                    }, i * 120);
                });
            }, 500);
        }, () => ARPEGG_INTERVAL + Math.random() * 3000);
    }

    /* ── SFX FUNCTIONS ─────────────────────────────────── */

    function sfxEat() {
        const c = ensureCtx();
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

    /* ── TRANSPORT CONTROLS ────────────────────────────── */

    function start() {
        if (running) return;
        ensureCtx();
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
        sfxEat, sfxDie, sfxGameOver, sfxGameStart, sfxRespawn
    };
}
