// Designsystem (v3.121.0): Comic-Stil passend zu Ladebild und App-Symbol.
//
// EINE Quelle fuer Farben, Schriften und die Grundbausteine (Knopf, Panel,
// Hintergrund, Abzeichen). Bis v3.120.0 trug jede der rund 430 Stellen im
// Spielcode ihr eigenes Inline-Objekt im dunklen „Glas"-Look — ein neuer Look
// haette 430 Aenderungen bedeutet. Neue Oberflaechen nehmen die Bausteine von
// hier, statt Farben zu tippen.
//
// Herkunft der Farben: abgenommen vom Ladebild (assets/ladebild) und vom Logo
// (tools/logo.cjs) — Himmelblau, Burgrot, Gold, Laternengruen, dunkle
// Comic-Kontur. Schriften lokal gebuendelt (public/fonts, OFL): Lilita One fuer
// Titel und Knoepfe, Nunito fuer Fliesstext.

export const SCHRIFT_TITEL = "'Lilita One','Nunito',system-ui,sans-serif";
export const SCHRIFT_TEXT = "'Nunito',system-ui,sans-serif";

export const FARBE = {
  kontur: '#1b0f06',        // dunkle Comic-Kontur (Logo)
  nacht: '#0d1f45',         // tiefes Blau fuer Panels
  himmel: '#4fa9f2',
  himmelTief: '#1f5fc4',
  gold: '#ffd23a', goldHell: '#fff3a6', goldTief: '#f08a12',
  rot: '#ef4b34', rotTief: '#a8261a',
  gruen: '#4fd36b', gruenTief: '#1c8a3a', laterne: '#a6ff4d',
  lila: '#8b55e0', lilaTief: '#4f2a99',
  holz: '#9a6232', holzTief: '#5c3716',
  pergament: '#fff6e0',
  // textGedaempft (v3.128.0) heller: '#cfe0ff' lag auf dem oberen Panel-Blau bei
  // 3,9:1 — gemessen, unter WCAG 4,5:1 fuer kleine Schrift. '#e3edff' ≈ 4,7:1.
  text: '#fffaf0', textGedaempft: '#e3edff', textDunkel: '#2a1a0a',
};

// Knopf-Varianten: hell (oben), mitte, tief (unten), Kante (3D-Schatten)
const KNOPF = {
  gold:  ['#fff2a0', '#ffc72e', '#f08a12', '#9a4a06'],
  blau:  ['#8fd0ff', '#3f97ea', '#1f5fc4', '#123a80'],
  gruen: ['#b6f59a', '#4fd36b', '#1c8a3a', '#0f5422'],
  rot:   ['#ffb19e', '#ef4b34', '#a8261a', '#62140c'],
  lila:  ['#d6b8ff', '#8b55e0', '#4f2a99', '#2c1660'],
  grau:  ['#e6edf7', '#9aaac4', '#62718d', '#343e52'],
};

// Text mit Comic-Kontur (lesbar auf jedem Untergrund).
//
// **Seit v3.131.0 waechst die Kontur mit der Schrift** (gemeldet: „Schrift
// teilweise unscharf"). Vorher war sie fest 1,5 px in vier schraegen
// Richtungen — bei 12-px-Schrift ist das ein Achtel der Buchstabenhoehe: Die
// Innenraeume von a, e, D, u liefen zu, Buchstaben verschmolzen zu einem
// Klumpen, und das sah auf dem Geraet wie Unschaerfe aus. Jetzt 7 % der
// Schriftgroesse (0,75 bis 1,6 px) in ACHT Richtungen — gleichmaessig rund,
// ohne Kerben. `em` bezieht sich auf die Schrift des Elements selbst; wer die
// Kontur erbt, erbt den beim Elternteil berechneten Pixelwert.
// Keine Unschaerfe (blur) in Textschatten — `tests/stil.test.js`.
const KW = 'clamp(0.75px, 0.07em, 1.6px)';
const KD = `calc(${KW} * 0.72)`;
const KF = 'clamp(1px, 0.11em, 2.5px)';
const neg = (x) => `calc(-1 * ${x})`;
export const KONTURTEXT = [
  `0 ${KF} 0`, `${KW} 0 0`, `${neg(KW)} 0 0`, `0 ${KW} 0`, `0 ${neg(KW)} 0`,
  `${KD} ${KD} 0`, `${neg(KD)} ${KD} 0`, `${KD} ${neg(KD)} 0`, `${neg(KD)} ${neg(KD)} 0`,
].map((x) => `${x} ${FARBE.kontur}`).join(', ');

/** Grosser Spielknopf: Verlauf, dicke Kontur, 3D-Kante, Glanzlicht. */
export function knopf(variante = 'gold', extra = {}) {
  const [hell, mitte, tief, kante] = KNOPF[variante] || KNOPF.gold;
  return {
    fontFamily: SCHRIFT_TITEL, fontWeight: 400, letterSpacing: '0.02em',
    color: FARBE.text, textShadow: KONTURTEXT,
    background: `linear-gradient(180deg, ${hell} 0%, ${mitte} 48%, ${tief} 100%)`,
    border: `3px solid ${FARBE.kontur}`, borderRadius: 16,
    boxShadow: `0 5px 0 ${kante}, 0 7px 0 ${FARBE.kontur}, 0 10px 18px rgba(0,0,0,0.35), inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -4px 0 rgba(0,0,0,0.18)`,
    cursor: 'pointer', padding: '14px 16px', fontSize: 19,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    ...extra,
  };
}

/** Kleiner runder Symbolknopf (Profil, Erfolge, Shop …). */
export function symbolKnopf(variante = 'blau', extra = {}) {
  const [hell, mitte, tief, kante] = KNOPF[variante] || KNOPF.blau;
  return {
    position: 'relative', width: 46, height: 46, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: FARBE.text, background: `linear-gradient(180deg, ${hell} 0%, ${mitte} 50%, ${tief} 100%)`,
    border: `3px solid ${FARBE.kontur}`, borderRadius: 14,
    boxShadow: `0 4px 0 ${kante}, 0 5px 0 ${FARBE.kontur}, inset 0 2px 0 rgba(255,255,255,0.5)`,
    cursor: 'pointer', ...extra,
  };
}

/** Dunkler Schleier hinter Dialogen. */
export function schleier(extra = {}) {
  return {
    position: 'fixed', inset: 0, background: 'rgba(8,16,40,0.72)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
    ...extra,
  };
}

/** Dialog-/Karten-Panel: tiefblau mit goldenem Innenrand und Comic-Kontur. */
export function panel(extra = {}) {
  return {
    background: `linear-gradient(180deg, #2c69c9 0%, #1d4a9e 38%, ${FARBE.nacht} 100%)`,
    border: `4px solid ${FARBE.kontur}`, borderRadius: 22,
    boxShadow: `inset 0 0 0 3px ${FARBE.gold}, inset 0 6px 0 3px rgba(255,255,255,0.12), 0 8px 0 ${FARBE.kontur}, 0 18px 40px rgba(0,0,0,0.55)`,
    color: FARBE.text, fontFamily: SCHRIFT_TEXT, padding: 22,
    ...extra,
  };
}

/** Helle Innenkarte auf einem Panel (Listen, Werte). */
export function karte(extra = {}) {
  return {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))',
    border: `2px solid rgba(10,20,50,0.55)`, borderRadius: 14,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
    padding: '10px 12px', ...extra,
  };
}

/** Ueberschrift im Comic-Stil (Gold mit Kontur). */
export function titel(groesse = 26, extra = {}) {
  return {
    fontFamily: SCHRIFT_TITEL, fontWeight: 400, fontSize: groesse, lineHeight: 1.05,
    color: FARBE.goldHell, textShadow: `0 3px 0 ${FARBE.goldTief}, ${KONTURTEXT}, 0 6px 10px rgba(0,0,0,0.45)`,
    letterSpacing: '0.01em', ...extra,
  };
}

/** Kleines Abzeichen / Pille (Gold, Werte, Phase). */
export function pille(variante = 'gold', extra = {}) {
  const [hell, mitte, tief] = KNOPF[variante] || KNOPF.gold;
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: SCHRIFT_TITEL, fontSize: 15, color: FARBE.text, textShadow: KONTURTEXT,
    background: `linear-gradient(180deg, ${hell}, ${mitte} 55%, ${tief})`,
    border: `2.5px solid ${FARBE.kontur}`, borderRadius: 999, padding: '3px 12px',
    boxShadow: `0 3px 0 ${FARBE.kontur}, inset 0 2px 0 rgba(255,255,255,0.45)`,
    ...extra,
  };
}

/** Bildschirm-Hintergrund mit gemaltem Bild (Menue) und Abdunklung unten. */
export function bildHintergrund(url, extra = {}) {
  return {
    backgroundColor: FARBE.nacht,
    backgroundImage: `linear-gradient(180deg, rgba(13,31,69,0.15) 0%, rgba(13,31,69,0.05) 35%, rgba(13,31,69,0.55) 75%, rgba(13,31,69,0.85) 100%), url(${url})`,
    backgroundSize: 'cover', backgroundPosition: 'center', ...extra,
  };
}

/**
 * Hintergrundbild mit KRAEFTIGER Abdunklung (v3.128.0) — fuer Schirme, auf
 * denen viel kleiner Text direkt ueber dem Bild steht (Ergebnis). Beim
 * normalen `bildHintergrund` waren Statistik-Kacheln, Untertitel und
 * Nebenknoepfe auf hellem Himmel und Wiese kaum zu sehen (gemeldet aus der
 * TestFlight-App).
 */
export function bildHintergrundDunkel(url, extra = {}) {
  return {
    backgroundColor: FARBE.nacht,
    backgroundImage: `linear-gradient(180deg, rgba(13,31,69,0.62) 0%, rgba(13,31,69,0.70) 45%, rgba(13,31,69,0.88) 100%), url(${url})`,
    backgroundSize: 'cover', backgroundPosition: 'center', ...extra,
  };
}

/** Feste dunkle Kachel fuer Werte direkt auf Bildern (lesbar auf jedem Grund). */
export function wertKachel(extra = {}) {
  return {
    background: 'linear-gradient(180deg, rgba(29,74,158,0.95), rgba(13,31,69,0.95))',
    border: `2.5px solid ${FARBE.kontur}`, borderRadius: 14,
    boxShadow: `inset 0 0 0 1.5px rgba(255,210,58,0.55), 0 3px 0 ${FARBE.kontur}`,
    color: FARBE.text, ...extra,
  };
}

export const VARIANTEN = Object.keys(KNOPF);

/** Kleiner Umschalter (Sprache, Ton, Musik, Vibration): an = farbig, aus = grau. */
export function schalter(an, variante = 'gruen', extra = {}) {
  return knopf(an ? variante : 'grau', {
    padding: '6px 13px', fontSize: 15, borderRadius: 12, gap: 6, minWidth: 46,
    boxShadow: `0 3px 0 ${FARBE.kontur}, inset 0 2px 0 rgba(255,255,255,0.45)`,
    opacity: an ? 1 : 0.82, ...extra,
  });
}

/** Spielerkasten in der Spielanzeige: kraeftige Spielerfarbe mit Comic-Kontur. */
export function spielerKasten(variante = 'blau', extra = {}) {
  const [hell, mitte, tief] = KNOPF[variante] || KNOPF.blau;
  return {
    background: `linear-gradient(180deg, ${hell} 0%, ${mitte} 45%, ${tief} 100%)`,
    border: `3px solid ${FARBE.kontur}`, borderRadius: 14,
    boxShadow: `0 3px 0 ${FARBE.kontur}, inset 0 2px 0 rgba(255,255,255,0.4)`,
    color: FARBE.text, fontFamily: SCHRIFT_TITEL, textShadow: KONTURTEXT,
    ...extra,
  };
}
