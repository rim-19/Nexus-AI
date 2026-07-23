// Tiny Web Audio SFX — no asset files. Very subtle, Linear-style.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

export const isMuted = () =>
  typeof window !== "undefined" && localStorage.getItem("nexus:muted") === "1";
export const setMuted = (m: boolean) => localStorage.setItem("nexus:muted", m ? "1" : "0");

function tone(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.03) {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur);
}

export const sfx = {
  click: () => tone(520, 0.05, "sine", 0.02),
  pop: () => { tone(300, 0.05, "triangle", 0.03); setTimeout(() => tone(620, 0.06, "triangle", 0.025), 40); },
  chime: () => { tone(660, 0.12, "sine", 0.025); setTimeout(() => tone(880, 0.14, "sine", 0.02), 90); },
};
