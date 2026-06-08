import admin from "firebase-admin";

let db = null;

export function initFirebase() {
  if (admin.apps.length > 0) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (!serviceAccount) {
    console.warn("FIREBASE_SERVICE_ACCOUNT not set — Firebase features disabled");
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log("Firebase initialized");
}

function getDb() {
  if (!db) throw Object.assign(new Error("Firebase not initialized"), { status: 503 });
  return db;
}

// ─── User Wallet ─────────────────────────────────────────────────────────────

export async function getUserWallet(userId) {
  const snap = await getDb()
    .collection("wallets")
    .doc(userId)
    .collection("cards")
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function addCardToWallet(userId, cardId, nickname = null) {
  const ref = getDb()
    .collection("wallets")
    .doc(userId)
    .collection("cards")
    .doc(cardId);

  await ref.set({
    card_id: cardId,
    nickname,
    added_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { card_id: cardId, nickname };
}

export async function removeCardFromWallet(userId, cardId) {
  await getDb()
    .collection("wallets")
    .doc(userId)
    .collection("cards")
    .doc(cardId)
    .delete();
}

// ─── Spend Profile ────────────────────────────────────────────────────────────

export async function getSpendProfile(userId) {
  const snap = await getDb().collection("spend_profiles").doc(userId).get();
  return snap.exists ? snap.data() : {};
}

export async function updateSpendProfile(userId, profile) {
  await getDb()
    .collection("spend_profiles")
    .doc(userId)
    .set(
      {
        ...profile,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

// ─── Analytics Events ────────────────────────────────────────────────────────

export async function trackEvent(userId, eventType, payload) {
  await getDb().collection("events").add({
    user_id: userId,
    event_type: eventType,
    payload,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Event types for funnel tracking:
// "recommendation_viewed"  — user got a card recommendation
// "recommendation_accepted" — user tapped "use this card"
// "card_added"              — user added a card to wallet
// "gap_analysis_run"        — user ran gap analysis
// "upgrade_clicked"         — user clicked an upgrade recommendation
