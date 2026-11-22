// All sound is synthesised with WebAudio — no audio files, no network.
// Engine hum follows speed, the siren wails while the wanted level is up,
// and gunshots, pickups, crashes and mission jingles are short blips of
// oscillator and noise. Everything is guarded: audio starts only after the
// first user gesture and never throws if the context is unavailable.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
    if (!ctx || !enabled) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* sound is decoration, never fatal */ }
  }

  function noise(dur, vol = 0.3, low = 400) {
    if (!ctx || !enabled) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* sound is decoration, never fatal */ }
  }

  return {
    /** Call from any user gesture; resumes a suspended context. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setEngine(speedRatio, driving) {
      if (!ctx || !enabled) return;
      try {
        engineGain.gain.value = driving ? 0.05 + speedRatio * 0.09 : 0;
        engineOsc.frequency.value = 55 + speedRatio * 130;
      } catch { /* ignore */ }
    },
    updateSiren(dt, wanted) {
      if (!ctx || !enabled) return;
      try {
        if (wanted > 0) {
          sirenTimer += dt;
          if (sirenTimer > 0.42) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 880 : 660;
          }
          sirenGain.gain.value = 0.045;
        } else {
          sirenGain.gain.value = 0;
        }
      } catch { /* ignore */ }
    },
    shoot() { noise(0.12, 0.35, 1800); blip(160, 0.08, 'square', 0.12, 60); },
    crash() { noise(0.25, 0.4, 500); },
    pickup() { blip(880, 0.12, 'sine', 0.2, 1320); },
    mission() { blip(523, 0.14, 'triangle', 0.25); setTimeout(() => blip(659, 0.14, 'triangle', 0.25), 130); setTimeout(() => blip(784, 0.3, 'triangle', 0.25), 260); },
    busted() { blip(220, 0.5, 'sawtooth', 0.2, 110); },
    toggleMute() { enabled = !enabled; return enabled; },
  };
}
