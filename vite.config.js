import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Ein Build fuer beide Ziele (ARCHITEKTUR.md E2): GitHub Pages UND Capacitor
// liefern dasselbe dist/ aus. Divergenz zwischen Web und App ist damit
// konstruktiv ausgeschlossen.
export default defineConfig({
  // Pages liegt unter /Fortress/, Capacitor laedt von der Wurzel des Bundles.
  // Relative Pfade funktionieren in BEIDEN Faellen — absolute nur in einem.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Der Spielcode ist ein einziger grosser Block; eine Warnung daran hilft
    // nicht weiter. Die Grenze steht bewusst hoch, damit echte Ausreisser
    // weiterhin auffallen.
    chunkSizeWarningLimit: 1500,
    target: 'es2020'
  },
  plugins: [
    // ARCHITEKTUR.md E6: Der Service Worker wird GENERIERT. Die frueher
    // handgepflegte CORE-Liste in sw.js war eine dokumentierte Falle — wer eine
    // neue Engine-Datei anlegte und den Eintrag vergass, merkte es erst beim
    // Nutzer ohne Netz. Ein generierter Worker kennt alle gebauten Dateien und
    // kann diesen Fehler nicht machen.
    VitePWA({
      registerType: 'autoUpdate',
      // Das Manifest liegt weiterhin als Datei in public/ und wird dort
      // gepflegt; das Plugin soll keines danebenlegen.
      manifest: false,
      injectRegister: null,          // die Registrierung steht schon in index.html
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,svg,json,mp3}'],
        // Store-Screenshots sind 4,7 MB und werden im Spiel NIE gebraucht —
        // sie stehen nur im Manifest fuer die Installationsansicht. Ohne diese
        // Ausnahme zahlt jeder Erstbesucher sie beim Vorladen mit.
        globIgnores: ['screenshots/**', '**/workbox-*.js'],
        // Der Spielcode-Chunk ist gross; die Voreinstellung (2 MB) wuerde ihn
        // stillschweigend NICHT vorladen und damit den Offline-Start brechen.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Nebenseiten sind eigene Dokumente, keine Routen der App.
        navigateFallbackDenylist: [/^\/(privacy|diagnose|stats|uebersicht|waffen|kanonentaktik|balancing|review|talk)\.html$/],
        cleanupOutdatedCaches: true
      }
    })
  ],
  server: { port: 8765 }
});
