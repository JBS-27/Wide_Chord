export function createAudio() {
  let ctx = null;
  let master = null;
  let fan = null;
  let fanGain = null;
  let turbine = null;
  let turbineGain = null;
  let noiseGain = null;
  let pump = null;
  let pumpGain = null;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    fan = ctx.createOscillator();
    fan.type = "sine";
    fanGain = ctx.createGain();
    fanGain.gain.value = 0;
    fan.connect(fanGain).connect(master);
    fan.start();

    turbine = ctx.createOscillator();
    turbine.type = "sawtooth";
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    turbineGain = ctx.createGain();
    turbineGain.gain.value = 0;
    turbine.connect(filter).connect(turbineGain).connect(master);
    turbine.start();

    const seconds = 2;
    const buffer = ctx.createBuffer(1, seconds * ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 160;
    band.Q.value = 0.45;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(band).connect(noiseGain).connect(master);
    noise.start();

    pump = ctx.createOscillator();
    pump.type = "sine";
    pump.frequency.value = 14;
    pumpGain = ctx.createGain();
    pumpGain.gain.value = 0;
    pump.connect(pumpGain).connect(master);
    pump.start();
  }

  return {
    resume() {
      ensure();
      return ctx?.resume();
    },
    update({ muted, n1, n3, throttle, oil, running }) {
      if (!ctx || !master) return;
      const audible = !muted && running;
      master.gain.setTargetAtTime(audible ? 0.42 : 0, ctx.currentTime, 0.05);
      fan.frequency.setTargetAtTime(32 + n1 * 58, ctx.currentTime, 0.08);
      fanGain.gain.setTargetAtTime(oil ? n1 * 0.02 : n1 * 0.2, ctx.currentTime, 0.08);
      turbine.frequency.setTargetAtTime(120 + n3 * 420, ctx.currentTime, 0.08);
      turbineGain.gain.setTargetAtTime(oil ? 0.004 : n3 * 0.035, ctx.currentTime, 0.08);
      noiseGain.gain.setTargetAtTime(oil ? 0.012 : throttle * 0.11 + (running ? 0.02 : 0), ctx.currentTime, 0.08);
      pumpGain.gain.setTargetAtTime(oil ? 0.08 : 0.01, ctx.currentTime, 0.08);
    },
  };
}
