// Sunset Bay sound: everything synthesized with WebAudio — engine hum,
// two-tone police sirens, gunshots, UI blips and a moody ambient loop.
// No audio files, no network: every sound is built from oscillators and
// filtered noise in code.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle wave whose pitch alternates on a slow LFO.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBurst(duration, filterFreq, gainValue, type = 'lowpass') {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function blip(freq, duration, gainValue, type = 'sine', when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainValue, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // A slow minor-key pad loop: Am – F – C – G arpeggios over a low root.
  // Scheduled a bar at a time so it never needs a file or a worker.
  const CHORDS = [
    [110, 220, 261.63, 329.63],
    [87.31, 174.61, 220, 261.63],
    [130.81, 196, 261.63, 329.63],
    [98, 196, 246.94, 293.66],
  ];
  function scheduleMusicBar() {
    if (!ctx || muted) return;
    const barLen = 2.4;
    const chord = CHORDS[musicStep % CHORDS.length];
    musicStep += 1;
    for (let i = 0; i < 4; i += 1) {
      blip(chord[i % chord.length], 0.55, 0.05, 'triangle', i * (barLen / 4));
    }
    blip(chord[0] / 2, barLen * 0.9, 0.07, 'sine', 0);
    musicTimer = window.setTimeout(scheduleMusicBar, barLen * 1000);
  }

  return {
    unlock() { resume(); },
    startMusic() {
      if (started) return;
      started = true;
      resume();
      if (ctx) scheduleMusicBar();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      if (m && musicTimer) { window.clearTimeout(musicTimer); musicTimer = null; }
      else if (!m && started && ctx && !musicTimer) scheduleMusicBar();
    },
    setEngine(speed, inCar) {
      if (!ctx) return;
      const target = inCar ? 0.05 + Math.min(0.16, Math.abs(speed) * 0.005) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 4.5, ctx.currentTime, 0.1);
      engineFilter.frequency.setTargetAtTime(280 + Math.abs(speed) * 22, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    gunshot() {
      resume();
      noiseBurst(0.14, 1800, 0.5, 'highpass');
      noiseBurst(0.2, 320, 0.4);
      blip(160, 0.1, 0.25, 'square');
    },
    enemyShot() {
      resume();
      noiseBurst(0.12, 1200, 0.22, 'highpass');
      blip(120, 0.08, 0.12, 'square');
    },
    reloadClick() { resume(); blip(900, 0.05, 0.12, 'square'); blip(620, 0.05, 0.12, 'square', 0.09); },
    emptyClick() { resume(); blip(1400, 0.03, 0.08, 'square'); },
    missionJingle() {
      resume();
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, 0.28, 0.12, 'triangle', i * 0.11));
    },
    hurtThud() { resume(); noiseBurst(0.18, 220, 0.35); blip(70, 0.18, 0.2, 'sine'); },
  };
}
