/* ==========================================================================
   GeoTrack – Dashboard Logic
   ========================================================================== */

(function () {
  const auth = firebase.auth();
  const db   = firebase.database();

  /* ── Auth guard ──────────────────────────────────────────────────────── */
  auth.onAuthStateChanged(user => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      auth.signOut().finally(() => window.location.replace("index.html"));
      return;
    }
    document.getElementById("user-email").textContent = user.email;
    initDashboard();
  });

  /* ── Logout button ───────────────────────────────────────────────────── */
  document.getElementById("logout-btn").addEventListener("click", () => {
    auth.signOut().then(() => window.location.replace("index.html"));
  });

  /* ── Session timeout ─────────────────────────────────────────────────── */
  let idleTimer = null;
  function resetIdleTimer() {
    if (!SESSION_TIMEOUT_MS) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      toast("Sessione scaduta per inattività.", "amber");
      setTimeout(() => auth.signOut(), 1500);
    }, SESSION_TIMEOUT_MS);
  }
  ["mousemove", "keydown", "click", "scroll"].forEach(ev =>
    document.addEventListener(ev, resetIdleTimer, { passive: true })
  );
  resetIdleTimer();

  /* ── Clock ───────────────────────────────────────────────────────────── */
  const clockEl = document.getElementById("live-clock");
  setInterval(() => {
    const now = new Date();
    clockEl.textContent = now.toISOString().replace("T", " ").substring(11, 19) + " UTC";
  }, 1000);

  /* ── State ───────────────────────────────────────────────────────────── */
  let map, clusterLayer, heatLayer;
  let allVisits = [];          // [{ id, lat, lon, timestamp, location, ... }]
  let activeFilter = "all";    // "today" | "24h" | "7d" | "30d" | "all" | "custom"
  let customStart = null, customEnd = null;
  let viewMode = "markers";    // "markers" | "heatmap"

  /* ── Map init ────────────────────────────────────────────────────────── */
  function initDashboard() {
    map = L.map("map", {
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: true
    }).setView([30, 10], 2);

    // Dark tiles (CARTO)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);

    clusterLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true
    });
    map.addLayer(clusterLayer);

    // Listen for data
    db.ref("/geoVisits").on("value", snapshot => {
      const data = snapshot.val() || {};
      allVisits = Object.keys(data).map(id => {
        const v = data[id] || {};
        return {
          id,
          lat: Number(v.lat),
          lon: Number(v.lon),
          timestamp: v.timestamp || null,
          location: v.location || "—",
          ua: v.ua || null,
          lang: v.lang || null,
          referrer: v.referrer || null,
          ip_city: v.ip_city || null,
          ip_region: v.ip_region || null,
          ip_country: v.ip_country || null,
          ip_org: v.ip_org || null
        };
      }).filter(v => isFinite(v.lat) && isFinite(v.lon));

      render();
    }, err => {
      console.error("DB read error:", err);
      toast("Errore lettura database. Verifica regole Firebase.", "error");
    });

    // Hide loader
    setTimeout(() => document.getElementById("loader").classList.add("hidden"), 400);

    // Wire filter chips
    document.querySelectorAll("[data-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        if (activeFilter !== "custom") { customStart = customEnd = null; }
        render();
      });
    });

    // Custom range
    const fromEl = document.getElementById("date-from");
    const toEl   = document.getElementById("date-to");
    [fromEl, toEl].forEach(el => el.addEventListener("change", () => {
      customStart = fromEl.value ? new Date(fromEl.value + "T00:00:00Z").getTime() : null;
      customEnd   = toEl.value   ? new Date(toEl.value   + "T23:59:59Z").getTime() : null;
      if (customStart || customEnd) {
        document.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("active"));
        document.querySelector('[data-filter="custom"]').classList.add("active");
        activeFilter = "custom";
        render();
      }
    }));

    // View mode toggle
    document.querySelectorAll("[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-view]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        viewMode = btn.dataset.view;
        render();
      });
    });

    // Export buttons
    document.getElementById("export-csv").addEventListener("click", () => exportCSV());
    document.getElementById("export-json").addEventListener("click", () => exportJSON());

    // Clear-all button
    document.getElementById("clear-all").addEventListener("click", () => {
      const filtered = filterVisits(allVisits);
      if (filtered.length === 0) { toast("Nessun dato da eliminare."); return; }
      const msg = `Eliminare ${filtered.length} visita/e nell'intervallo selezionato? L'operazione è irreversibile.`;
      if (!confirm(msg)) return;
      const updates = {};
      filtered.forEach(v => { updates["/geoVisits/" + v.id] = null; });
      db.ref().update(updates)
        .then(() => toast(`Eliminate ${filtered.length} visite.`, "amber"))
        .catch(err => toast("Errore: " + err.message, "error"));
    });

    // Recenter map
    document.getElementById("recenter").addEventListener("click", () => {
      const filtered = filterVisits(allVisits);
      fitBoundsToVisits(filtered);
    });
  }

  /* ── Filtering ───────────────────────────────────────────────────────── */
  function filterVisits(list) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(); startOfToday.setUTCHours(0,0,0,0);
    const startTodayMs = startOfToday.getTime();

    return list.filter(v => {
      const t = v.timestamp ? new Date(v.timestamp).getTime() : null;
      if (!t) return activeFilter === "all";
      switch (activeFilter) {
        case "today":  return t >= startTodayMs;
        case "24h":    return t >= now - day;
        case "7d":     return t >= now - 7 * day;
        case "30d":    return t >= now - 30 * day;
        case "custom": {
          if (customStart && t < customStart) return false;
          if (customEnd && t > customEnd) return false;
          return true;
        }
        case "all":
        default:       return true;
      }
    });
  }

  /* ── Rendering ───────────────────────────────────────────────────────── */
  function render() {
    const filtered = filterVisits(allVisits);

    renderStats(filtered);
    renderActivity(filtered);
    renderMap(filtered);

    document.getElementById("visit-count").textContent = filtered.length.toString().padStart(3, "0");
  }

  function renderStats(visits) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(); startOfToday.setUTCHours(0,0,0,0);
    const startTodayMs = startOfToday.getTime();

    const todayCount = allVisits.filter(v => v.timestamp && new Date(v.timestamp).getTime() >= startTodayMs).length;
    const last24 = allVisits.filter(v => v.timestamp && new Date(v.timestamp).getTime() >= now - day).length;
    const countries = new Set();
    allVisits.forEach(v => {
      const c = v.ip_country || (v.location && v.location.split(",").pop().trim());
      if (c && c !== "—") countries.add(c);
    });

    document.getElementById("stat-total").textContent    = allVisits.length.toLocaleString();
    document.getElementById("stat-today").textContent    = todayCount.toLocaleString();
    document.getElementById("stat-24h").textContent      = last24.toLocaleString();
    document.getElementById("stat-countries").textContent = countries.size.toLocaleString();
  }

  function renderMap(visits) {
    clusterLayer.clearLayers();
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }

    if (viewMode === "heatmap") {
      const heatPoints = visits.map(v => [v.lat, v.lon, 0.6]);
      heatLayer = L.heatLayer(heatPoints, {
        radius: 22, blur: 18, minOpacity: 0.35,
        gradient: {
          0.2: "#00a866",
          0.45: "#00ff9c",
          0.7: "#ffb020",
          0.9: "#ff4757"
        }
      }).addTo(map);
    } else {
      const icon = L.divIcon({
        className: "",
        html: '<div class="pin"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      visits.forEach(v => {
        const m = L.marker([v.lat, v.lon], { icon });
        m.bindPopup(popupHTML(v));
        clusterLayer.addLayer(m);
      });
    }
  }

  function popupHTML(v) {
    const ts = v.timestamp ? new Date(v.timestamp).toISOString().replace("T", " ").substring(0,19) + " UTC" : "—";
    const row = (label, value) => value && value !== "—"
      ? `<span class="popup-label">${label}</span><span class="popup-value">${escapeHtml(value)}</span>` : "";
    return `
      <div class="popup-title">${escapeHtml(v.location || "—")}</div>
      ${row("Timestamp", ts)}
      ${row("Coords", v.lat.toFixed(4) + ", " + v.lon.toFixed(4))}
      ${row("ISP / Org", v.ip_org)}
      ${row("Lingua", v.lang)}
      ${row("Referrer", v.referrer)}
      ${row("User-Agent", v.ua ? (v.ua.length > 60 ? v.ua.substring(0,60) + "…" : v.ua) : null)}
    `;
  }

  function renderActivity(visits) {
    const container = document.getElementById("activity-list");
    if (!visits.length) {
      container.innerHTML = '<div class="empty-state">Nessun dato nell\'intervallo</div>';
      return;
    }
    // Sort desc by timestamp
    const sorted = [...visits].sort((a, b) => {
      const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
      const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
      return tb - ta;
    });
    const recent = sorted.slice(0, 80);
    container.innerHTML = recent.map(v => {
      const t = v.timestamp ? new Date(v.timestamp) : null;
      const rel = t ? relativeTime(t) : "—";
      return `
        <div class="activity-item" data-id="${v.id}" data-lat="${v.lat}" data-lon="${v.lon}">
          <div class="activity-time">${rel}</div>
          <div class="activity-location">${escapeHtml(v.location || "—")}</div>
          <div class="activity-coords">${v.lat.toFixed(3)}, ${v.lon.toFixed(3)}</div>
          <button class="activity-delete" data-del="${v.id}" title="Elimina">✕</button>
        </div>
      `;
    }).join("");

    // Click to fly-to
    container.querySelectorAll(".activity-item").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.dataset.del) return;
        map.flyTo([Number(el.dataset.lat), Number(el.dataset.lon)], 10, { duration: 1.2 });
      });
    });
    // Delete buttons
    container.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.del;
        if (!confirm("Eliminare questa visita?")) return;
        db.ref("/geoVisits/" + id).remove()
          .then(() => toast("Visita eliminata.", "amber"))
          .catch(err => toast("Errore: " + err.message, "error"));
      });
    });
  }

  function fitBoundsToVisits(visits) {
    if (!visits.length) { map.setView([30, 10], 2); return; }
    const bounds = L.latLngBounds(visits.map(v => [v.lat, v.lon]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }

  /* ── Exports ─────────────────────────────────────────────────────────── */
  function exportCSV() {
    const visits = filterVisits(allVisits);
    if (!visits.length) { toast("Nessun dato da esportare."); return; }
    const headers = ["id","timestamp","lat","lon","location","ip_city","ip_region","ip_country","ip_org","lang","referrer","ua"];
    const rows = [headers.join(",")].concat(visits.map(v =>
      headers.map(h => {
        const val = v[h] == null ? "" : String(v[h]);
        // CSV escape
        return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
      }).join(",")
    ));
    downloadFile("geotrack-export-" + dateStamp() + ".csv", rows.join("\n"), "text/csv");
    toast("Esportazione CSV completata.");
  }

  function exportJSON() {
    const visits = filterVisits(allVisits);
    if (!visits.length) { toast("Nessun dato da esportare."); return; }
    downloadFile("geotrack-export-" + dateStamp() + ".json",
      JSON.stringify(visits, null, 2), "application/json");
    toast("Esportazione JSON completata.");
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function dateStamp() {
    return new Date().toISOString().substring(0, 10);
  }

  function relativeTime(date) {
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return Math.floor(diff) + "s fa";
    if (diff < 3600) return Math.floor(diff / 60) + "m fa";
    if (diff < 86400) return Math.floor(diff / 3600) + "h fa";
    if (diff < 2592000) return Math.floor(diff / 86400) + "g fa";
    return date.toISOString().substring(0, 10);
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg, kind) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast visible" + (kind ? " " + kind : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.className = "toast", 3000);
  }
})();
