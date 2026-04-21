# GeoTrack

> Geospatial Intelligence Dashboard — versione potenziata del tracker visitatori PezzaliAPP.

Mappa interattiva delle visite al tuo sito, con autenticazione admin, clustering marker, heatmap, filtri temporali, export CSV/JSON ed eliminazione dati. Tutti i dati transitano sulla tua istanza Firebase Realtime Database e la lettura è riservata al tuo account admin.

---

## ✨ Novità rispetto alla versione base

| Area                  | Prima                              | Ora                                                                 |
|-----------------------|------------------------------------|---------------------------------------------------------------------|
| Autenticazione        | Nessuna (mappa pubblica)           | Firebase Auth + email whitelist admin                               |
| UI                    | Titolo semplice + mappa            | Dashboard "mission control" con pannelli stats/filtri/attività      |
| Mappa                 | OSM standard, marker nudi          | Tile scuri CARTO, marker clustering, heatmap toggle                 |
| Statistiche           | —                                  | Visite totali, oggi, ultime 24h, paesi unici                        |
| Filtri                | —                                  | Oggi, 24h, 7g, 30g, custom range                                    |
| Dati raccolti         | lat, lon, timestamp, location      | + IP city/region/country/org, lingua, user-agent, referrer, pagina  |
| Export                | —                                  | CSV + JSON                                                          |
| Eliminazione          | —                                  | Singola visita + bulk filtrati                                      |
| Tracker               | Inline nella pagina                | `tracker.js` standalone + `tracker.html` per iframe                 |
| Regole Firebase       | Aperte                             | Read solo autenticato, write validato e immutabile                  |
| Sessione              | —                                  | Auto-logout dopo 30 min di inattività                               |

---

## 🗂 Struttura del progetto

```
GeoTrack/
├── index.html            # Pagina di login (entry point)
├── dashboard.html        # Dashboard protetta
├── tracker.html          # Pagina beacon (per iframe)
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js   # Config Firebase + email admin whitelist
│   ├── login.js
│   ├── dashboard.js
│   └── tracker.js           # Da includere sul sito principale
├── assets/
│   └── favicon.svg
├── firebase-rules.json   # Regole di sicurezza RTDB
├── README.md
├── LICENSE
└── .gitignore
```

---

## 🚀 Setup in 6 passi

### 1. Pubblica su GitHub

```bash
# Scompatta il file zip in una cartella
cd GeoTrack
git init
git add .
git commit -m "init: GeoTrack dashboard"
git branch -M main
git remote add origin https://github.com/<TUO-USER>/GeoTrack.git
git push -u origin main
```

### 2. Attiva GitHub Pages

Vai su **Settings → Pages** del repo, seleziona:
- **Source**: Deploy from a branch
- **Branch**: `main` / `(root)`

Il sito sarà disponibile su `https://<TUO-USER>.github.io/GeoTrack/`.

### 3. Configura Firebase Authentication

Nella [Firebase Console](https://console.firebase.google.com/) del tuo progetto `pezzaliapp-analytics`:

1. **Build → Authentication → Get started**.
2. Tab **Sign-in method** → abilita **Email/Password** → Save.
3. Tab **Users** → **Add user** → inserisci:
   - Email: la tua email admin (es. `admin@pezzaliapp.com`)
   - Password: scegli una password forte (min. 12 caratteri, mix di lettere/numeri/simboli)
4. Copia **esattamente** la stessa email nel file `js/firebase-config.js`:
   ```js
   const ADMIN_EMAILS = [
     "admin@pezzaliapp.com"   // ← LA TUA EMAIL
   ];
   ```
5. Committa e pusha il cambio.

> ⚠️ **Importante**: nella sezione **Authentication → Settings → User actions** puoi disabilitare il self-signup così nessuno può crearsi un account per conto suo.

### 4. Applica le regole di sicurezza Firebase

Nella Firebase Console:

1. **Build → Realtime Database → Rules**.
2. Copia-incolla **integralmente** il contenuto di `firebase-rules.json` e clicca **Publish**.

Le regole garantiscono:
- **Lettura**: solo utenti autenticati (quindi solo tu).
- **Scrittura**: consentita solo per creare nuovi record, ogni record è immutabile una volta scritto. Campi validati per tipo e lunghezza.
- **Delete**: consentito solo a utenti autenticati (tramite la dashboard).

### 5. Autorizza il dominio GitHub Pages

In **Authentication → Settings → Authorized domains** aggiungi:
- `<TUO-USER>.github.io`

Senza questo, il login fallirà con errore `auth/unauthorized-domain`.

### 6. Integra il tracker sul sito principale

Sul sito che vuoi monitorare (es. `pezzaliapp.com`), aggiungi una sola riga prima di `</body>`:

```html
<script src="https://<TUO-USER>.github.io/GeoTrack/js/tracker.js" defer></script>
```

Il tracker:
- Registra **una sola visita per sessione** (usa `sessionStorage`).
- Non rompe mai il sito in caso di errore (fallisce silenziosamente).
- Usa `ipapi.co` con fallback automatico su `ipwho.is`.
- Non richiede il permesso del browser per la geolocalizzazione — fa tutto via IP lookup.

In alternativa puoi embeddare `tracker.html` in un iframe invisibile:

```html
<iframe src="https://<TUO-USER>.github.io/GeoTrack/tracker.html"
        style="width:1px;height:1px;border:0;position:absolute;left:-9999px"
        title="beacon" aria-hidden="true"></iframe>
```

---

## 🔐 Sicurezza

**Chi può fare cosa**:

| Operazione                      | Utente anonimo (pubblico) | Admin autenticato |
|---------------------------------|:-------------------------:|:-----------------:|
| Leggere tutte le visite         | ❌                        | ✅                |
| Scrivere una nuova visita       | ✅ (ma validata)          | ✅                |
| Modificare una visita esistente | ❌                        | ❌ (immutabile)   |
| Eliminare una visita            | ❌                        | ✅                |
| Accedere alla dashboard         | ❌                        | ✅                |

**Note sulle API key Firebase**: il valore di `apiKey` nei file JS è pubblico per design. Nelle app web Firebase la sicurezza non si basa sul nascondere la chiave (impossibile lato client) ma sulle **Security Rules** e sulle **Authorized Domains**. Entrambe sono configurate in questo progetto.

**Protezione brute-force**: Firebase Auth blocca automaticamente tentativi ripetuti di login da stesso IP (`auth/too-many-requests`). Usa comunque una password forte.

**Auto-logout**: dopo 30 minuti di inattività la dashboard effettua il logout automatico. Modifica `SESSION_TIMEOUT_MS` in `js/firebase-config.js` per cambiarlo.

---

## 🇪🇺 Nota GDPR / Privacy

Questo sistema raccoglie dati di geolocalizzazione approssimativa (basata su IP) dei visitatori. Anche se l'IP non viene memorizzato direttamente, la combinazione **città + ISP + user-agent + timestamp** può configurarsi come dato personale ai sensi del GDPR.

**Buone pratiche**:
1. Inserisci un'informativa privacy sul sito che traccia i visitatori, menzionando:
   - Quali dati raccogli (geolocalizzazione IP approssimativa, browser, referrer).
   - Finalità (analisi del traffico, sicurezza).
   - Periodo di conservazione (usa la funzione "Elimina filtrati" periodicamente).
   - Base giuridica (es. legittimo interesse per analisi aggregate, oppure consenso).
2. Se usi base giuridica del consenso, mostra un banner cookie prima di includere `tracker.js`.
3. Conserva i dati solo per il tempo strettamente necessario.

---

## 🛠 Sviluppo locale

```bash
# Avvia un server locale (qualsiasi static server va bene)
python3 -m http.server 8080
# oppure
npx serve .
```

Apri `http://localhost:8080`. Firebase funziona anche in locale, ma devi aggiungere `localhost` agli **Authorized domains** di Firebase Auth.

---

## 📦 Librerie esterne (via CDN)

- [Leaflet 1.9.4](https://leafletjs.com/) — mappe
- [Leaflet.markercluster 1.5.3](https://github.com/Leaflet/Leaflet.markercluster)
- [Leaflet.heat 0.2.0](https://github.com/Leaflet/Leaflet.heat)
- [Firebase JS SDK 9.22.0](https://firebase.google.com/) (compat build)
- [CARTO Dark Matter tiles](https://carto.com/attribution/)
- Font: [IBM Plex Sans/Mono](https://fonts.google.com/specimen/IBM+Plex+Sans) + [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) (Google Fonts)

---

## 📝 Licenza

MIT — vedi [LICENSE](LICENSE).

---

**Costruito per PezzaliAPP · 2026**
