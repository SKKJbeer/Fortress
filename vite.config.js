import { defineConfig } from 'vite';

// Ein Build fuer beide Ziele (Architektur E2): GitHub Pages UND Capacitor
// liefern dasselbe dist/ aus. Divergenz zwischen Web und App ist damit
// konstruktiv ausgeschlossen.
export default defineConfig({
  // Pages liegt unter /Fortress/, Capacitor laedt von der Wurzel des Bundles.
  // Relative Pfade funktionieren in BEIDEN Faellen — absolute nur in einem.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Der Spielcode ist ein einziger grosser Block; Warnungen daran helfen
    // nicht weiter. Die Grenze steht bewusst hoch, damit echte Ausreisser
    // weiterhin auffallen.
    chunkSizeWarningLimit: 1500,
    target: 'es2020'
  },
  server: { port: 8765 }
});
