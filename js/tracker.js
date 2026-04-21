/* ==========================================================================
   GeoTrack – Standalone Tracker
   --------------------------------------------------------------------------
   Include su qualsiasi pagina del sito che vuoi monitorare:
       <script src="https://<user>.github.io/GeoTrack/js/tracker.js" defer></script>
   Non richiede nessun markup. Registra una singola visita per sessione.
   ========================================================================== */

(function () {
  // Evita doppio-tracking nella stessa sessione
  try {
    if (sessionStorage.getItem("__geotrack_done")) return;
  } catch (e) { /* sessionStorage non disponibile: procedi comunque */ }

  // Firebase config (compat SDK già caricato? Caricalo al volo se manca)
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDBxmabJywcziV-k6n0fO04z6Y2ZKpnOEs",
    authDomain: "pezzaliapp-analytics.firebaseapp.com",
    databaseURL: "https://pezzaliapp-analytics-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "pezzaliapp-analytics",
    storageBucket: "pezzaliapp-analytics.appspot.com",
    messagingSenderId: "918001653069",
    appId: "1:918001653069:web:e3fcfdbc21c88cb161a784"
  };

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && window.firebase.database) return;
    if (!window.firebase || !window.firebase.initializeApp) {
      await loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
    }
    if (!window.firebase.database) {
      await loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js");
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  }

  async function getGeo() {
    // Primary: ipapi.co; fallback: ipwho.is
    try {
      const r = await fetch("https://ipapi.co/json/");
      if (r.ok) {
        const j = await r.json();
        if (j && j.latitude && j.longitude) return {
          lat: j.latitude,
          lon: j.longitude,
          city: j.city, region: j.region, country: j.country_name,
          org: j.org || j.asn || null
        };
      }
    } catch (e) { /* fallthrough */ }

    try {
      const r = await fetch("https://ipwho.is/");
      if (r.ok) {
        const j = await r.json();
        if (j && j.success && j.latitude && j.longitude) return {
          lat: j.latitude,
          lon: j.longitude,
          city: j.city, region: j.region, country: j.country,
          org: (j.connection && j.connection.org) || null
        };
      }
    } catch (e) { /* fallthrough */ }

    return null;
  }

  async function run() {
    try {
      await ensureFirebase();
      const geo = await getGeo();
      if (!geo) return;

      const payload = {
        lat: Number(geo.lat),
        lon: Number(geo.lon),
        timestamp: new Date().toISOString(),
        location: [geo.city, geo.country].filter(Boolean).join(", ") || "—",
        ip_city: geo.city || null,
        ip_region: geo.region || null,
        ip_country: geo.country || null,
        ip_org: geo.org || null,
        lang: (navigator.language || "").substring(0, 16),
        ua: (navigator.userAgent || "").substring(0, 250),
        referrer: (document.referrer || "").substring(0, 250) || null,
        page: location.hostname + location.pathname
      };

      const id = Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
      await firebase.database().ref("/geoVisits/" + id).set(payload);

      try { sessionStorage.setItem("__geotrack_done", "1"); } catch (e) {}
    } catch (err) {
      // Silent: tracking non deve mai rompere il sito
      if (window.console && console.debug) console.debug("[GeoTrack]", err);
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(run, 800);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(run, 800));
  }
})();
