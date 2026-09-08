// Tiny synthesised UI sounds on Web Audio, so there are no files to load.
// Off until someone turns them on; the AudioContext is only created then,
// which keeps the browser's autoplay rules happy.

export function createSfx() {
    let ctx = null;
    let enabled = false;

    function ensure() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    }

    // one enveloped oscillator note
    function tone({ freq, type = 'sine', start = 0, dur = 0.15, gain = 0.15, slide = null }) {
        const c = ensure();
        if (!c) return;
        const t0 = c.currentTime + start;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t0);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(c.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
    }

    const sounds = {
        click: () => tone({ freq: 1600, type: 'square', dur: 0.03, gain: 0.035 }),
        menu:  () => tone({ freq: 2200, type: 'square', dur: 0.02, gain: 0.025 }),
        open:  () => { tone({ freq: 523, type: 'triangle', dur: 0.12, gain: 0.1 }); tone({ freq: 784, type: 'triangle', start: 0.07, dur: 0.18, gain: 0.09 }); },
        close: () => { tone({ freq: 660, type: 'triangle', dur: 0.1, gain: 0.09 }); tone({ freq: 392, type: 'triangle', start: 0.06, dur: 0.16, gain: 0.08 }); },
        ding:  () => { tone({ freq: 1046, type: 'triangle', dur: 0.55, gain: 0.14 }); tone({ freq: 2093, type: 'sine', dur: 0.4, gain: 0.05 }); tone({ freq: 1568, type: 'sine', start: 0.02, dur: 0.3, gain: 0.03 }); },
        error: () => tone({ freq: 240, type: 'sawtooth', dur: 0.28, gain: 0.07, slide: 150 }),
        chime: () => {
            // a soft rising arpeggio with a pad underneath, the log-on kind
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.13, dur: 0.7, gain: 0.11 }));
            tone({ freq: 261.63, type: 'sine', dur: 1.1, gain: 0.07 });
            tone({ freq: 392, type: 'sine', start: 0.2, dur: 0.9, gain: 0.05 });
        },
    };

    return {
        get enabled() { return enabled; },
        set enabled(v) { enabled = !!v; if (enabled) ensure(); },
        /** Call from a user gesture so a suspended context can start. */
        unlock() { if (enabled) ensure(); },
        play(name) {
            if (!enabled || !sounds[name]) return;
            try { sounds[name](); } catch { /* audio is a nicety, never an error */ }
        },
    };
}
