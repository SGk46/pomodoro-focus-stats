/** Free ambient / chime sounds via Web Audio API (no external files). */

let ctx = null;
let ambientNodes = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export async function ensureAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") await c.resume();
  return c;
}

/** Soft bell at end of phase */
export async function playChime() {
  const c = await ensureAudio();
  if (!c) return;
  const now = c.currentTime;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, now + i * 0.12);
    g.gain.linearRampToValueAtTime(0.12, now + i * 0.12 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 1.2);
    o.connect(g);
    g.connect(c.destination);
    o.start(now + i * 0.12);
    o.stop(now + i * 0.12 + 1.3);
  });
}

/** Gentle low drone while focusing */
export async function startAmbient() {
  const c = await ensureAudio();
  if (!c || ambientNodes) return;
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  o1.type = "sine";
  o2.type = "sine";
  o1.frequency.value = 110;
  o2.frequency.value = 164.81;
  f.type = "lowpass";
  f.frequency.value = 400;
  g.gain.value = 0.0001;
  o1.connect(f);
  o2.connect(f);
  f.connect(g);
  g.connect(c.destination);
  o1.start();
  o2.start();
  g.gain.exponentialRampToValueAtTime(0.025, c.currentTime + 1.5);
  ambientNodes = { o1, o2, g };
}

export function stopAmbient() {
  if (!ambientNodes || !ctx) return;
  const { o1, o2, g } = ambientNodes;
  const t = ctx.currentTime;
  try {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o1.stop(t + 0.7);
    o2.stop(t + 0.7);
  } catch {
    /* already stopped */
  }
  ambientNodes = null;
}
