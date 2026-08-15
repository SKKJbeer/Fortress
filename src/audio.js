// Ton und Musik (aus dem Grossblock herausgeloest, v3.78.0).
//
// Vollstaendig eigenstaendig: kein React, kein Spielzustand, keine Uebersetzung.
// Der Block lag nur deshalb in app.js, weil dort urspruenglich alles lag.
//
// Die Klangdateien liegen unter public/sounds/ und werden beim ersten
// Zeigergeraet-Ereignis geladen — vorher verbietet iOS das Abspielen.
import { __spreadValues, __spreadProps } from './spread.js';
// SFX.haptics ruft die Vibration ueber die Plattform-Weiche auf. Beim
// Herausloesen aus dem Grossblock blieb der Import in app.js zurueck —
// jeder Tastenton warf danach 'vibriere is not defined'.
import { vibriere } from './platform.ts';
const SFX = {
  ctx: null,
  enabled: true,
  haptics: true,
  _ensure() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) {}
    return this.ctx;
  },
  resume() {
    // iOS: nach App-Wechsel/Anruf steht der Context auf "interrupted" (nicht
    // "suspended") — beide Zustände wieder anwerfen (v3.32.2).
    try { const c = this._ensure(); if (c && c.state !== "running") c.resume().catch(() => {}); } catch (e) {}
    this._unlockMediaChannel();
    if (this._isIOS) this._initTags();
    this._load();
  },
  // iOS-Stummschalter-Fix (v3.32.2): Web-Audio läuft auf dem KLINGELTON-Kanal —
  // steht der Hardware-Schalter auf lautlos, ist das Spiel komplett stumm.
  // Einmaliges Abspielen eines stillen <audio>-Elements (playsinline) routet
  // die App auf den MEDIEN-Kanal, der den Schalter ignoriert (Standard-Trick
  // aller Mobile-Web-Games, vgl. unmute.js).
  // iOS-Erkennung (auch iPadOS, das sich als MacIntel meldet)
  _isIOS: typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)),
  // HTML-Audio-Pool (v3.32.3): auf iOS ist das der PRIMÄRE Abspielpfad.
  // <audio>-Elemente laufen auf dem Medien-Kanal (spielen auch bei Stumm-
  // schalter) und haben keine AudioContext-Zustandsfallen. Jedes Element wird
  // bei der ersten Geste einmal stumm angespielt ("gesegnet") — danach darf
  // es programmatisch (auch außerhalb von Gesten) erneut abgespielt werden.
  _tags: {},
  _tagsReady: false,
  _initTags() {
    if (this._tagsReady) return;
    this._tagsReady = true;
    try {
      for (const n of ["shoot", "impact", "destroy", "place", "buy", "win", "lose"]) {
        const a = new Audio("sounds/" + n + ".mp3");
        a.preload = "auto";
        a.setAttribute("playsinline", "");
        this._tags[n] = a;
        a.muted = true;
        const pr = a.play();
        if (pr && pr.then) pr.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
        else { a.pause(); a.currentTime = 0; a.muted = false; }
      }
    } catch (e) {}
  },
  _playTag(name, vol) {
    const a = this._tags[name];
    if (!a) return false;
    try {
      if (!a.paused) { a.pause(); }
      a.currentTime = 0;
      try { a.volume = vol != null ? vol : 1; } catch (e) {}
      const pr = a.play();
      if (pr && pr.catch) pr.catch(() => {});
      return true;
    } catch (e) { return false; }
  },
  _mediaUnlocked: false,
  _unlockMediaChannel() {
    if (this._mediaUnlocked) return;
    try {
      const tag = document.createElement("audio");
      tag.setAttribute("playsinline", "");
      tag.preload = "auto";
      tag.loop = false;
      // ~50ms Stille als WAV-Data-URI (44-Byte-Header + Nullsamples)
      tag.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQQAAAAAAAAA";
      const pr = tag.play();
      if (pr && pr.then) pr.then(() => { this._mediaUnlocked = true; }).catch(() => {});
      else this._mediaUnlocked = true;
    } catch (e) {}
  },
  _bufs: {},
  _loading: false,
  _load() {
    if (this._loading) return;
    const c = this._ensure();
    if (!c) return;
    this._loading = true;
    for (const n of ["shoot", "impact", "destroy", "place", "buy", "win", "lose"]) {
      fetch("sounds/" + n + ".mp3")
        .then((r) => r.ok ? r.arrayBuffer() : Promise.reject(0))
        .then((ab) => c.decodeAudioData(ab))
        .then((buf) => { this._bufs[n] = buf; })
        .catch(() => {});
    }
  },
  // Sample abspielen; false wenn (noch) kein Buffer → Aufrufer nutzt Fallback-Töne
  _play(name, vol) {
    if (!this.enabled) return true;
    // iOS: HTML-Audio (Medien-Kanal) zuerst — WebAudio hängt dort am
    // Klingelton-Kanal und ist bei Stummschalter lautlos (v3.32.3).
    if (this._isIOS && this._playTag(name, vol)) return true;
    const buf = this._bufs[name];
    if (!buf) return false;
    try {
      const c = this._ensure();
      if (!c) return false;
      const s = c.createBufferSource();
      s.buffer = buf;
      const g = c.createGain();
      g.gain.value = vol != null ? vol : 1;
      s.connect(g).connect(c.destination);
      s.start();
      return true;
    } catch (e) { return false; }
  },
  _tone(o) {
    if (!this.enabled) return;
    const c = this._ensure();
    if (!c) return;
    try {
      const { freq = 440, type = "sine", dur = 0.15, vol = 0.2, freqEnd = null, delay = 0 } = o || {};
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
      gain.gain.setValueAtTime(1e-4, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch (e) {}
  },
  _noise(o) {
    if (!this.enabled) return;
    const c = this._ensure();
    if (!c) return;
    try {
      const { dur = 0.2, vol = 0.2, delay = 0, filterFreq = 1000 } = o || {};
      const t0 = c.currentTime + delay;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(filterFreq, t0);
      src.connect(filter).connect(gain).connect(c.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    } catch (e) {}
  },
  vibrate(p) {
    if (!this.haptics) return;
    vibriere(p);   // Weiche: Capacitor-Haptik in der App, navigator.vibrate im Browser
  },
  shoot() { if (!this._play("shoot", 0.85)) { this._tone({ freq: 320, freqEnd: 90, type: "sawtooth", dur: 0.18, vol: 0.16 }); this._noise({ dur: 0.12, vol: 0.10, filterFreq: 800 }); } this.vibrate(15); },
  impact() { if (!this._play("impact", 0.9)) { this._noise({ dur: 0.25, vol: 0.20, filterFreq: 600 }); this._tone({ freq: 120, freqEnd: 40, type: "square", dur: 0.2, vol: 0.10 }); } this.vibrate(25); },
  destroy() { if (!this._play("destroy", 1)) { this._noise({ dur: 0.4, vol: 0.26, filterFreq: 500 }); this._tone({ freq: 90, freqEnd: 30, type: "sawtooth", dur: 0.35, vol: 0.16 }); } this.vibrate([30, 40, 60]); },
  place() { if (!this._play("place", 0.65)) this._tone({ freq: 300, freqEnd: 220, type: "triangle", dur: 0.08, vol: 0.10 }); this.vibrate(8); },
  buy() { if (!this._play("buy", 0.8)) this._tone({ freq: 680, freqEnd: 880, type: "triangle", dur: 0.1, vol: 0.12 }); this.vibrate(10); },
  win() { if (!this._play("win", 0.9)) [523, 659, 784, 1047].forEach((f, i) => this._tone({ freq: f, type: "triangle", dur: 0.18, vol: 0.2, delay: i * 0.12 })); this.vibrate([20, 40, 20, 40, 60]); },
  lose() { if (!this._play("lose", 0.85)) [392, 330, 262, 196].forEach((f, i) => this._tone({ freq: f, type: "sawtooth", dur: 0.22, vol: 0.15, delay: i * 0.14 })); this.vibrate([80, 60, 120]); }
};
// Modul-Scope (v3.34.0): SFX explizit als Global exportieren — Testsuite und
// Konsolen-Debugging greifen darauf zu; als klassisches Script war das implizit.
window.SFX = SFX;
// ── Hintergrundmusik (v3.38.0): CC0-Loops (music/menu.mp3, music/game.mp3,
// Quellen in CREDITS.md). HTML-Audio mit Loop; Lautstärke bewusst dezent.
// NICHT im SW-Precache (3 MB) — der Fetch-Handler cached sie beim ersten
// Abspielen (Offline danach). Autoplay-Policy: play() darf scheitern; die
// pointerdown-Geste (siehe SFX.resume-Effect) holt den Start nach.
const MUSIC = {
  el: null,
  cur: null,
  enabled: true,
  userVol: 0.45, // Master (Regler im Menü, fortress_music_vol)
  _rel: { menu: 1.0 }, // Menü voll; Welt-Tracks laufen über den 0.75-Default
  _mk() {
    if (this.el) return;
    try { this.el = new Audio(); this.el.loop = true; this.el.preload = "none"; } catch (e) {}
  },
  // iOS-Fix (v3.39.0): el.volume ist auf iOS READ-ONLY (Apple erlaubt keine
  // Programm-Lautstärke am Media-Element). Deshalb wird das Element einmalig
  // durch einen WebAudio-GainNode geroutet — Gain wirkt auch auf iOS. Gelingt
  // das nicht (alter Browser), bleibt el.volume der Fallback.
  _gain: null,
  _wire() {
    if (this._gain || !this.el) return;
    try {
      const c = SFX._ensure();
      if (!c) return;
      const srcNode = c.createMediaElementSource(this.el);
      this._gain = c.createGain();
      srcNode.connect(this._gain);
      this._gain.connect(c.destination);
    } catch (e) {}
  },
  _applyVol(track) {
    const v = Math.max(0, Math.min(1, (this._rel[track] != null ? this._rel[track] : 0.75) * this.userVol));
    if (this._gain) { this._gain.gain.value = v; try { this.el.volume = 1; } catch (e) {} }
    else { try { this.el.volume = v; } catch (e) {} }
  },
  play(track) {
    this.cur = track;
    if (!this.enabled || !track) return;
    this._mk();
    if (!this.el) return;
    const srcName = "music/" + track + ".mp3";
    if (!this.el.src.endsWith(srcName)) this.el.src = srcName;
    this._wire();
    this._applyVol(track);
    const pr = this.el.play();
    if (pr && pr.catch) pr.catch(() => {}); // vor erster Geste blockiert — retry() holt nach
  },
  retry() { if (this.enabled && this.cur && this.el && this.el.paused) this.play(this.cur); },
  stop() { if (this.el) { try { this.el.pause(); } catch (e) {} } },
  setEnabled(on) {
    this.enabled = on;
    if (on) this.play(this.cur); else this.stop();
  },
  setVolume(v) {
    this.userVol = Math.max(0, Math.min(1, v));
    if (this.el && this.cur) this._applyVol(this.cur);
  }
};
window.MUSIC = MUSIC;

export { SFX, MUSIC };
