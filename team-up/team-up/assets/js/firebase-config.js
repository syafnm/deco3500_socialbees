/* ==========================================================
   Optional: real-time sync across devices
   ----------------------------------------------------------
   Left as null, Team Up stores everything in this browser's
   localStorage. That's perfect for demos (tutor in one tab,
   students in other tabs) but phones and laptops won't see
   each other.

   To run it in a real class:
   1. Create a free Firebase project → add a Web app.
   2. Build → Realtime Database → Create database.
   3. Paste the web app config below.
   See README.md for the database rules to use.
   ========================================================== */
window.TU = window.TU || {};

TU.FIREBASE_CONFIG = null;

/* Example:
TU.FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'team-up-deco3500.firebaseapp.com',
  databaseURL: 'https://team-up-deco3500-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'team-up-deco3500',
  appId: '1:123:web:abc'
};
*/
