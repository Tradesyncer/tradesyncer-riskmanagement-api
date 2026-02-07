import admin from "firebase-admin";

let initialized = false;

/**
 * Initialize Firebase Admin SDK.
 * Uses GOOGLE_APPLICATION_CREDENTIALS env var or FIREBASE_SERVICE_ACCOUNT_JSON.
 */
export function initFirebase(): void {
  if (initialized) return;

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error("Missing FIREBASE_DATABASE_URL env var");
  }

  const serviceAccountJson = process.env.SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS file path
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL,
    });
  }

  initialized = true;
  console.log("Firebase Admin initialized, DB:", databaseURL);
}

/**
 * Verify a Firebase ID token from the frontend.
 * Returns the decoded token with uid.
 */
export async function verifyAuthToken(
  idToken: string
): Promise<admin.auth.DecodedIdToken> {
  return admin.auth().verifyIdToken(idToken);
}

/**
 * Look up a Tradovate connection token from the Realtime Database.
 *
 * Path: renewAccessToken/{userId}/{connectionRef}
 * Returns: { token, url, ref, uid, timestamp }
 */
export async function getConnectionToken(
  userId: string,
  connectionRef: string
): Promise<{
  token: string;
  url: string;
  ref: string;
  uid: string;
  timestamp: number;
}> {
  const db = admin.database();
  const snapshot = await db
    .ref(`renewAccessToken/${userId}/${connectionRef}`)
    .once("value");

  const data = snapshot.val();
  if (!data || !data.token) {
    throw new Error(
      `No Tradovate token found for user ${userId}, connection ${connectionRef}`
    );
  }

  return data;
}
