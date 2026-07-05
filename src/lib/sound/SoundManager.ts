/**
 * SoundManager — procedural Web Audio sound engine.
 *
 * All effects are synthesized at play time (oscillators + filtered noise),
 * so there are no audio assets to load or license. Sounds are grouped into
 * categories that can be toggled independently; a master mute and volume
 * are persisted to localStorage. The AudioContext is created lazily on the
 * first user gesture (required by browser autoplay policies).
 *
 * The "music" category is reserved for future background tracks.
 */

export type SoundCategory = "ui" | "dice" | "money" | "build" | "alert" | "music";

export type SoundName =
  | "click"
  | "open"
  | "close"
  | "cardDraw"
  | "diceRoll"
  | "diceLand"
  | "coin"
  | "cash"
  | "chip"
  | "spend"
  | "build"
  | "sprawl"
  | "raise"
  | "remodel"
  | "reorganize"
  | "error"
  | "success"
  | "notify"
  | "trade"
  | "turn"
  | "score"
  | "win"
  | "gameOver";

export interface SoundSettings {
  muted: boolean;
  /** 0..1 master volume */
  volume: number;
  categories: Record<SoundCategory, boolean>;
}

const STORAGE_KEY = "lov-sound-settings";

const DEFAULT_SETTINGS: SoundSettings = {
  muted: false,
  volume: 0.7,
  categories: { ui: true, dice: true, money: true, build: true, alert: true, music: true },
};

const CATEGORY_OF: Record<SoundName, SoundCategory> = {
  click: "ui",
  open: "ui",
  close: "ui",
  cardDraw: "ui",
  diceRoll: "dice",
  diceLand: "dice",
  coin: "money",
  cash: "money",
  chip: "money",
  spend: "money",
  build: "build",
  sprawl: "build",
  raise: "build",
  remodel: "build",
  reorganize: "build",
  error: "alert",
  success: "alert",
  notify: "alert",
  trade: "alert",
  turn: "alert",
  score: "alert",
  win: "alert",
  gameOver: "alert",
};

// ---------------------------------------------------------------------------
// Settings store (subscribable for React via useSyncExternalStore)
// ---------------------------------------------------------------------------

type Listener = () => void;

class SettingsStore {
  private settings: SoundSettings;
  private listeners = new Set<Listener>();

  constructor() {
    this.settings = this.load();
  }

  private load(): SoundSettings {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<SoundSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        categories: { ...DEFAULT_SETTINGS.categories, ...(parsed.categories ?? {}) },
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  get(): SoundSettings {
    return this.settings;
  }

  set(patch: Partial<SoundSettings>) {
    this.settings = {
      ...this.settings,
      ...patch,
      categories: { ...this.settings.categories, ...(patch.categories ?? {}) },
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // private browsing / quota — settings just won't persist
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const soundSettings = new SettingsStore();

// ---------------------------------------------------------------------------
// Synth engine
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  master!.gain.value = soundSettings.get().volume;
  return { ctx, master: master! };
}

function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface ToneOpts {
  freq: number;
  /** end frequency for a pitch glide */
  to?: number;
  type?: OscillatorType;
  at?: number;
  dur?: number;
  gain?: number;
  attack?: number;
}

/** One enveloped oscillator note. `at` is seconds from now. */
function tone(o: ToneOpts) {
  const a = audio();
  if (!a) return;
  const { freq, to, type = "sine", at = 0, dur = 0.15, gain = 0.25, attack = 0.005 } = o;
  const t0 = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

interface NoiseOpts {
  at?: number;
  dur?: number;
  gain?: number;
  /** bandpass center frequency */
  freq?: number;
  to?: number;
  q?: number;
}

/** Filtered noise burst — clicks, chips, dice ticks, card swishes. */
function noise(o: NoiseOpts) {
  const a = audio();
  if (!a) return;
  const { at = 0, dur = 0.06, gain = 0.25, freq = 2000, to, q = 1.2 } = o;
  const t0 = a.ctx.currentTime + at;
  const src = a.ctx.createBufferSource();
  src.buffer = getNoise(a.ctx);
  src.loop = true;
  const filter = a.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, t0);
  if (to) filter.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  filter.Q.value = q;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(a.master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ---------------------------------------------------------------------------
// Sound recipes
// ---------------------------------------------------------------------------

const RECIPES: Record<SoundName, () => void> = {
  click() {
    noise({ freq: 2600, dur: 0.035, gain: 0.16, q: 2 });
    tone({ freq: 1800, dur: 0.04, gain: 0.05 });
  },
  open() {
    noise({ freq: 900, to: 3200, dur: 0.14, gain: 0.1 });
    tone({ freq: 520, to: 740, dur: 0.14, gain: 0.06 });
  },
  close() {
    noise({ freq: 2600, to: 700, dur: 0.12, gain: 0.08 });
    tone({ freq: 700, to: 480, dur: 0.12, gain: 0.05 });
  },
  cardDraw() {
    noise({ freq: 500, to: 5200, dur: 0.18, gain: 0.2, q: 0.8 });
    noise({ at: 0.14, freq: 3400, dur: 0.03, gain: 0.12, q: 3 });
  },
  diceRoll() {
    // A tumble of irregular ticks.
    let t = 0;
    for (let i = 0; i < 8; i++) {
      noise({ at: t, freq: 2200 + Math.random() * 2200, dur: 0.028, gain: 0.11 + Math.random() * 0.07, q: 4 });
      t += 0.045 + i * 0.014 + Math.random() * 0.02;
    }
  },
  diceLand() {
    noise({ freq: 3000, dur: 0.03, gain: 0.18, q: 3 });
    tone({ freq: 180, to: 90, dur: 0.09, gain: 0.2, type: "triangle" });
  },
  coin() {
    tone({ freq: 1046, dur: 0.07, gain: 0.12, type: "square" });
    tone({ at: 0.06, freq: 1568, dur: 0.22, gain: 0.12, type: "square" });
  },
  cash() {
    tone({ freq: 1046, dur: 0.08, gain: 0.1, type: "triangle" });
    tone({ at: 0.07, freq: 1318, dur: 0.08, gain: 0.1, type: "triangle" });
    tone({ at: 0.14, freq: 1568, dur: 0.2, gain: 0.12, type: "triangle" });
    noise({ at: 0.02, freq: 5000, dur: 0.1, gain: 0.04, q: 1 });
  },
  chip() {
    noise({ freq: 2400, dur: 0.03, gain: 0.22, q: 5 });
    noise({ at: 0.05, freq: 2900, dur: 0.03, gain: 0.16, q: 5 });
  },
  spend() {
    noise({ freq: 2400, dur: 0.03, gain: 0.18, q: 5 });
    tone({ at: 0.03, freq: 480, to: 300, dur: 0.14, gain: 0.1, type: "triangle" });
  },
  build() {
    tone({ freq: 110, to: 60, dur: 0.16, gain: 0.3, type: "triangle" });
    noise({ at: 0.02, freq: 1800, dur: 0.04, gain: 0.14, q: 2 });
    noise({ at: 0.14, freq: 2400, dur: 0.05, gain: 0.12, q: 3 });
    tone({ at: 0.16, freq: 660, dur: 0.12, gain: 0.06 });
  },
  sprawl() {
    tone({ freq: 90, to: 55, dur: 0.14, gain: 0.26, type: "triangle" });
    noise({ at: 0.1, freq: 2000, dur: 0.05, gain: 0.12, q: 2 });
    tone({ at: 0.16, freq: 520, to: 700, dur: 0.14, gain: 0.07 });
  },
  raise() {
    tone({ freq: 120, to: 70, dur: 0.12, gain: 0.24, type: "triangle" });
    tone({ at: 0.12, freq: 160, to: 95, dur: 0.12, gain: 0.24, type: "triangle" });
    tone({ at: 0.26, freq: 784, dur: 0.14, gain: 0.07 });
  },
  remodel() {
    noise({ freq: 800, to: 3600, dur: 0.22, gain: 0.12, q: 1 });
    tone({ at: 0.16, freq: 880, dur: 0.14, gain: 0.08 });
  },
  reorganize() {
    for (let i = 0; i < 5; i++) {
      noise({ at: i * 0.05, freq: 2400 + i * 300, dur: 0.03, gain: 0.12, q: 4 });
    }
    tone({ at: 0.28, freq: 988, dur: 0.14, gain: 0.07 });
  },
  error() {
    tone({ freq: 170, dur: 0.16, gain: 0.14, type: "square" });
    tone({ freq: 120, at: 0.03, dur: 0.16, gain: 0.12, type: "square" });
  },
  success() {
    tone({ freq: 523, dur: 0.09, gain: 0.1 });
    tone({ at: 0.08, freq: 659, dur: 0.09, gain: 0.1 });
    tone({ at: 0.16, freq: 784, dur: 0.2, gain: 0.12 });
  },
  notify() {
    tone({ freq: 880, dur: 0.1, gain: 0.09 });
    tone({ at: 0.12, freq: 1108, dur: 0.18, gain: 0.09 });
  },
  trade() {
    tone({ freq: 740, dur: 0.09, gain: 0.09 });
    tone({ at: 0.1, freq: 932, dur: 0.09, gain: 0.09 });
    tone({ at: 0.2, freq: 740, dur: 0.14, gain: 0.08 });
  },
  turn() {
    tone({ freq: 880, dur: 0.5, gain: 0.1 });
    tone({ freq: 1320, at: 0.02, dur: 0.4, gain: 0.05 });
    tone({ at: 0.16, freq: 1174, dur: 0.5, gain: 0.09 });
  },
  score() {
    tone({ freq: 784, dur: 0.09, gain: 0.1, type: "triangle" });
    tone({ at: 0.09, freq: 988, dur: 0.09, gain: 0.1, type: "triangle" });
    tone({ at: 0.18, freq: 1175, dur: 0.24, gain: 0.12, type: "triangle" });
  },
  win() {
    const seq = [523, 659, 784, 1046, 784, 1046];
    seq.forEach((f, i) =>
      tone({ at: i * 0.13, freq: f, dur: i === seq.length - 1 ? 0.7 : 0.16, gain: 0.12, type: "triangle" }),
    );
    seq.forEach((f, i) => tone({ at: i * 0.13 + 0.01, freq: f * 2, dur: 0.12, gain: 0.04 }));
  },
  gameOver() {
    tone({ freq: 220, dur: 1.1, gain: 0.16, type: "triangle" });
    tone({ freq: 277, dur: 1.1, gain: 0.1, type: "triangle" });
    tone({ freq: 330, dur: 1.1, gain: 0.08, type: "triangle" });
    noise({ freq: 4000, dur: 0.5, gain: 0.03, q: 0.5 });
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Play a named sound, honoring mute + category settings. Safe on the server. */
export function playSound(name: SoundName) {
  const s = soundSettings.get();
  if (s.muted || !s.categories[CATEGORY_OF[name]]) return;
  if (!audio()) return;
  try {
    RECIPES[name]();
  } catch {
    // Audio failures must never break gameplay.
  }
}

export function setMuted(muted: boolean) {
  soundSettings.set({ muted });
}

export function setVolume(volume: number) {
  soundSettings.set({ volume: Math.min(1, Math.max(0, volume)) });
}

export function setCategoryEnabled(category: SoundCategory, enabled: boolean) {
  soundSettings.set({ categories: { ...soundSettings.get().categories, [category]: enabled } });
}
