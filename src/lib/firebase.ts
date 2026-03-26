import admin from "firebase-admin";
import { logger } from "./grafana";

let app: admin.app.App | null = null;

/**
 * Get (or lazily initialize) the Firebase Admin app.
 * Deferred so that dotenv has time to load env vars before we read them.
 */
export function getFirebaseAdmin(): admin.app.App {
  if (app) return app;

  const serviceAccountJson = process.env.SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  logger.info("Firebase Admin initialized (auth only)");
  return app;
}

/**
 * Verify a Firebase ID token from the frontend.
 * Returns the decoded token with uid.
 */
export async function verifyAuthToken(
  idToken: string
): Promise<admin.auth.DecodedIdToken> {
  return getFirebaseAdmin().auth().verifyIdToken(idToken);
}
