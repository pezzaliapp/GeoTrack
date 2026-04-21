/* ==========================================================================
   GeoTrack – Firebase Configuration
   --------------------------------------------------------------------------
   NOTE: Firebase web API keys are safe to expose in client code — security
   is enforced via Firebase Security Rules (see firebase-rules.json), NOT by
   hiding the key. What matters is the security rules and the allow-list.
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDBxmabJywcziV-k6n0fO04z6Y2ZKpnOEs",
  authDomain: "pezzaliapp-analytics.firebaseapp.com",
  databaseURL: "https://pezzaliapp-analytics-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pezzaliapp-analytics",
  storageBucket: "pezzaliapp-analytics.appspot.com",
  messagingSenderId: "918001653069",
  appId: "1:918001653069:web:e3fcfdbc21c88cb161a784"
};

/* ──────────────────────────────────────────────────────────────────────────
   ADMIN ALLOW-LIST
   --------------------------------------------------------------------------
   Only the email(s) listed here are allowed to access the dashboard.
   Any other authenticated user is signed out immediately on arrival.
   ────────────────────────────────────────────────────────────────────────── */
const ADMIN_EMAILS = [
  "pezzalialessandro@gmail.com"
];

/* ──────────────────────────────────────────────────────────────────────────
   SESSION TIMEOUT (milliseconds)
   Auto-signout after this period of inactivity on the dashboard.
   Set to 0 to disable.
   ────────────────────────────────────────────────────────────────────────── */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minuti

/* Initialize Firebase once globally */
if (typeof firebase !== "undefined" && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
