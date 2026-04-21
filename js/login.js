/* ==========================================================================
   GeoTrack – Login Handler
   ========================================================================== */

(function () {
  const auth = firebase.auth();

  const form     = document.getElementById("login-form");
  const emailEl  = document.getElementById("email");
  const passEl   = document.getElementById("password");
  const alertEl  = document.getElementById("login-alert");
  const submitEl = document.getElementById("login-submit");

  function showError(msg) {
    alertEl.textContent = "⚠ " + msg;
    alertEl.classList.add("visible");
  }

  function hideError() {
    alertEl.classList.remove("visible");
  }

  // Live clock in footer
  const clockEl = document.getElementById("utc-clock");
  function tickClock() {
    if (!clockEl) return;
    const now = new Date();
    const utc = now.toISOString().replace("T", " ").substring(0, 19) + " UTC";
    clockEl.textContent = utc;
  }
  tickClock();
  setInterval(tickClock, 1000);

  // If already signed in as allowed admin, skip login
  auth.onAuthStateChanged(user => {
    if (user && ADMIN_EMAILS.includes(user.email)) {
      window.location.replace("dashboard.html");
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const email = emailEl.value.trim();
    const pwd   = passEl.value;

    if (!email || !pwd) {
      showError("Credenziali mancanti.");
      return;
    }

    submitEl.disabled = true;
    submitEl.textContent = "AUTENTICAZIONE…";

    try {
      const cred = await auth.signInWithEmailAndPassword(email, pwd);
      if (!ADMIN_EMAILS.includes(cred.user.email)) {
        await auth.signOut();
        showError("Accesso negato. Credenziali non autorizzate.");
        submitEl.disabled = false;
        submitEl.textContent = "ACCEDI →";
        return;
      }
      // Success — redirect
      window.location.replace("dashboard.html");
    } catch (err) {
      let msg = "Autenticazione fallita.";
      switch (err.code) {
        case "auth/invalid-email":       msg = "Email non valida."; break;
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
                                         msg = "Credenziali errate."; break;
        case "auth/too-many-requests":   msg = "Troppi tentativi. Riprova più tardi."; break;
        case "auth/network-request-failed": msg = "Errore di rete."; break;
      }
      showError(msg);
      submitEl.disabled = false;
      submitEl.textContent = "ACCEDI →";
    }
  });
})();
