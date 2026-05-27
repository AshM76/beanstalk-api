const admin = require("firebase-admin");

// Reuse the firebase-admin default app initialised in
// controllers/app/notifications/notifications.controller.js. If this file
// loads first, initialise the same app here so there is exactly one.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    })
  });
}

const db = admin.firestore();
const COLLECTION = "ai_usage";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function getUsage(userId) {
  const date = todayUtc();
  const docId = `${userId}_${date}`;
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) {
    return { count: 0, date };
  }
  const data = snap.data() || {};
  return { count: data.count || 0, date };
}

async function incrementUsage(userId) {
  const date = todayUtc();
  const docId = `${userId}_${date}`;
  await db.collection(COLLECTION).doc(docId).set(
    {
      date,
      count: admin.firestore.FieldValue.increment(1),
    },
    { merge: true }
  );
}

async function isLimited(userId, isPremium, freeLimit = 5) {
  if (isPremium) return false;
  const { count } = await getUsage(userId);
  return count >= freeLimit;
}

module.exports = { getUsage, incrementUsage, isLimited };
