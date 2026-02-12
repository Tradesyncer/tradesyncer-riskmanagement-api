import admin from "firebase-admin";

let initialized = false;

/**
 * Initialize Firebase Admin SDK (for auth token verification only).
 */
export function initFirebase(): void {
  if (initialized) return;

  const serviceAccountJson = process.env.SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  initialized = true;
  console.log("Firebase Admin initialized (auth only)");
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
