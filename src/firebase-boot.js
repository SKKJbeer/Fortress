// Firebase-Start (aus index.html herausgeloest, v3.78.0).
//
// Laeuft als EIGENES Modul mit `async`, damit es nicht auf das Spielmodul
// wartet: der Verbindungsaufbau soll bereits laufen, waehrend React startet.
// Aus demselben Grund liegt es NICHT in app.js — dort wuerde es an dessen
// Ladezeit haengen.
import { initializeApp } from "firebase/app";
    import { getDatabase, ref, set, update, remove, get, onValue, off, runTransaction, onDisconnect }
      from "firebase/database";
    import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
             signInAnonymously, onAuthStateChanged, GoogleAuthProvider,
             linkWithRedirect, signInWithRedirect, signInWithCredential, getRedirectResult, signOut }
      from "firebase/auth";
    import { kontoVerknuepfbar } from "./platform.ts";
    // Ist bereits ein Firebase-Ersatz installiert, wird NICHT ueberschrieben.
    // Seit das SDK mitgebuendelt ist (Architektur E3), kann die Initialisierung
    // nicht mehr am Netz scheitern — ohne diese Weiche wuerde sie den in der
    // E2E-Suite vorab gesetzten Mock verdraengen und die Tests liefen gegen die
    // ECHTE Produktivdatenbank. In der App ist die Bedingung immer erfuellt.
    if (typeof window !== "undefined" && window.__fb) {
      window.dispatchEvent(new Event("fb-ready"));
    } else
    try {
      // ── Firebase-Konfiguration ───────────────────────────────────────────
      //
      // **Der `apiKey` ist KEIN Geheimnis.** Er ist eine oeffentliche Kennung,
      // die in jeder Firebase-Web-App im JavaScript mitgeliefert wird und fuer
      // jeden mit den Entwicklerwerkzeugen lesbar ist. Er gewaehrt keinen
      // Datenzugriff — darueber entscheiden allein die Security Rules. Deshalb
      // steht er hier im Code und nicht in den GitHub-Secrets. Das echte
      // Geheimnis des Projekts ist der Dienstkonto-Schluessel (Admin SDK), und
      // der umgeht alle Regeln; er hat hier nichts zu suchen.
      //
      // Bis v3.102.0 fehlte der Schluessel. Ohne ihn wirft `getAuth()`
      // (`auth/invalid-api-key`), `uid` bleibt null, Cloud-Save laeuft nie an
      // und die auth-gebundenen Regeln liessen sich nicht veroeffentlichen.
      //
      // Nur die Felder, die dieses Spiel benutzt:
      //   apiKey      — Auth (identitytoolkit) spricht ohne ihn nicht
      //   authDomain  — Ziel der Google-Weiterleitung (signInWithRedirect)
      //   databaseURL — Realtime Database
      //   projectId   — Projektzuordnung
      //   appId       — identifiziert diese App im Projekt
      // Weggelassen: storageBucket (kein Storage), messagingSenderId (keine
      // Push-Nachrichten), measurementId (kein Analytics). Was nicht drinsteht,
      // kann auch nicht versehentlich Verbindungen aufbauen.
      const app = initializeApp({
        apiKey: "AIzaSyBOmaWUaDKjSQCKZbEhYdy-PMl9LRQ-azg",
        authDomain: "fortress-cbe30.firebaseapp.com",
        databaseURL: "https://fortress-cbe30-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "fortress-cbe30",
        appId: "1:263415833676:web:73aed868626060a26c40e9",
      });
      // ── Firebase App Check (v3.39.2) ─────────────────────────────────────
      // Schützt Realtime Database + Queue vor Skript-/REST-Abuse und Flood-DoS.
      // INAKTIV, solange der reCAPTCHA-v3-Site-Key leer ist (kein Bruch, kein
      // Netzwerk-Load). So aktivierst du App Check:
      //   1. Firebase Console → App Check → Web-App registrieren → reCAPTCHA v3.
      //      Site-Key wird bei google.com/recaptcha/admin/create für die Domain
      //      skkjbeer.github.io erstellt (Typ: reCAPTCHA v3).
      //   2. Den SITE-Key (NICHT das Secret) unten eintragen und deployen.
      //   3. Erst wenn in der App-Check-Console Tokens ankommen (Metrics):
      //      Realtime Database auf "Erzwungen/Enforced" stellen.
      // Dynamischer Import → ein Ausfall des App-Check-Moduls bricht NIE die
      // Firebase-Initialisierung (Spiel läuft weiter).
      const APPCHECK_SITE_KEY = ""; // <-- reCAPTCHA v3 Site-Key hier eintragen
      if (APPCHECK_SITE_KEY) {
        import("firebase/app-check")
          .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
            try {
              initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY),
                isTokenAutoRefreshEnabled: true
              });
            } catch (e) { window.__appCheckError = e && (e.code || e.message); }
          })
          .catch((e) => { window.__appCheckError = e && e.message; });
      }
      const db = getDatabase(app);
      window.__fb = { db, ref, set, update, remove, get, onValue, off, runTransaction, onDisconnect, uid: null,
                      // Cloud-Save (v3.72.0): Konto-Verknuepfung
                      GoogleAuthProvider, linkWithRedirect, signInWithRedirect, signInWithCredential,
                      getRedirectResult, signOut, anon: true, mail: null };
      window.dispatchEvent(new Event("fb-ready"));
      // Anonyme Authentifizierung (kostenlos im Spark-Plan). BEST EFFORT:
      // Ist "Anonymous" in der Firebase-Console noch NICHT aktiviert, schlägt der
      // Login fehl → uid bleibt null → das Spiel läuft unverändert mit der lokalen
      // Profil-ID weiter (kein Bruch). Erst nach Aktivierung + neuen Rules greift die Bindung.
      try {
        // ── Auth-Start: in der APP ohne Weiterleitungs-Aufloeser (v3.111.4) ──
        //
        // GEMESSEN auf dem Geraet (Selbstauskunft aus v3.111.2):
        //   „Verbindung: SDK ✓ · keine Anmeldung · keine Verbindung"
        // Kein Anmeldefehler, kein `navigator.onLine=false` — die Anmeldung
        // SCHLUG also nicht fehl, sie HING. Und mit ihr die Datenbank: Das
        // RTDB-SDK holt vor dem Verbinden ein Auth-Token; bleibt die
        // Auth-Initialisierung offen, kommt nie eine Verbindung zustande.
        // Deshalb ging weder Matchmaking noch die oeffentlich lesbare
        // Bestenliste — und im Safari desselben Telefons lief alles.
        //
        // URSACHE: `getAuth()` installiert den Popup-/Redirect-Aufloeser, und
        // `getRedirectResult()` unten ERZWINGT dessen Start. Der laedt ein
        // iframe von `<authDomain>/__/auth/iframe` — eine fremde Herkunft,
        // geladen aus einer Seite unter eigenem Schema (`capacitor://localhost`).
        // Im WebView bleibt dieser Ladevorgang haengen. Im Browser nicht.
        //
        // Und der Aufruf hatte dort nie einen Zweck: Konto-Verknuepfung ist in
        // der App ausdruecklich AUS (`kontoVerknuepfbar()`, ARCHITEKTUR/CLAUDE.md,
        // wegen Apple 5.1.1(v)/4.8). Die App bezahlte also mit ihrer gesamten
        // Online-Faehigkeit fuer eine Funktion, die sie gar nicht anbietet.
        //
        // `initializeAuth` OHNE `popupRedirectResolver` startet die Anmeldung
        // ohne dieses iframe. Die Persistenz wird ausdruecklich benannt, statt
        // sie raten zu lassen.
        const auth = kontoVerknuepfbar()
          ? getAuth(app)
          : initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
        window.__fb.auth = auth;
        onAuthStateChanged(auth, (user) => {
          window.__fb.uid = user ? user.uid : null;
          // isAnonymous unterscheidet "nur Geraet" von "mit Google gesichert" —
          // davon haengt ab, ob der Fortschritt eine Neuinstallation ueberlebt.
          window.__fb.anon = user ? user.isAnonymous !== false : true;
          window.__fb.mail = (user && user.email) || null;
          window.dispatchEvent(new Event("fb-auth"));
        });
        // Rueckkehr von der Google-Weiterleitung auswerten (v3.72.0).
        // REDIRECT statt Popup — ein Auth-Popup bricht in der TWA (siehe CLAUDE.md).
        //
        // NUR im Browser (v3.111.4): In der App gibt es keine Verknuepfung, von
        // der man zurueckkehren koennte — und dieser Aufruf war es, der dort die
        // ganze Anmeldung zum Haengen brachte (Begruendung oben).
        if (kontoVerknuepfbar())
        getRedirectResult(auth)
          .then((res) => {
            if (res && res.user) window.dispatchEvent(new Event("fb-linked"));
          })
          .catch((e) => {
            const code = e && e.code;
            // Das Google-Konto haengt schon an einem ANDEREN Spielstand. Dann
            // ist Verknuepfen unmoeglich — stattdessen zu jenem Konto wechseln.
            // Der lokale Stand geht nicht verloren: er wird beim naechsten
            // Sync ueber mergeProfiles mit dem Cloud-Stand zusammengefuehrt.
            if (code === "auth/credential-already-in-use" ||
                code === "auth/email-already-in-use") {
              try {
                const cred = GoogleAuthProvider.credentialFromError(e);
                if (cred) {
                  signInWithCredential(auth, cred)
                    .then(() => window.dispatchEvent(new Event("fb-linked")))
                    .catch((e2) => { window.__fbLinkError = e2 && (e2.code || e2.message); });
                  return;
                }
              } catch (e3) {}
            }
            if (code) window.__fbLinkError = code;
          });
        // Eine HAENGENDE Anmeldung muss auffallen. Der Fehlerpfad allein
        // genuegt nicht: In der App kam weder ein Ergebnis noch ein Fehler,
        // und die Selbstauskunft hatte dadurch nichts zu melden ausser
        // „keine Anmeldung". Zehn Sekunden sind grosszuegig — gemessen
        // antwortet die Anmeldung in unter einer Sekunde.
        let angemeldet = false;
        signInAnonymously(auth)
          .then(() => { angemeldet = true; })
          .catch((e) => { window.__fbAuthError = e && (e.code || e.message); });
        setTimeout(() => {
          if (!angemeldet && !window.__fb.uid && !window.__fbAuthError)
            window.__fbAuthError = "Anmeldung antwortet nicht (10s)";
        }, 1e4);
      } catch (e) { window.__fbAuthError = e && e.message; }
    } catch (e) {
      console.error("Firebase init failed:", e);
      window.__fbError = e.message;
    }
