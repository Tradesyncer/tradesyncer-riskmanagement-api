import { Request, Response, NextFunction } from "express";
import { TradovateAuth } from "../lib/auth";
import { verifyAuthToken, getConnectionToken } from "./firebase";

/**
 * Authenticates the request using a Firebase ID token,
 * then looks up the Tradovate access token from Firebase RTDB
 * based on the connectionRef in the request body or query.
 *
 * Attaches to req:
 *   - tradovateAuth: TradovateAuth instance ready to make API calls
 *   - userId: Firebase user ID
 *   - connectionRef: the connection reference
 */
export async function firebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract Firebase ID token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[middleware] No Authorization header");
      res.status(401).json({ error: "Missing Authorization: Bearer <firebase_id_token>" });
      return;
    }

    const idToken = authHeader.slice(7);
    if (!idToken) {
      console.log("[middleware] Empty auth token");
      res.status(401).json({ error: "Empty auth token" });
      return;
    }

    // 2. Verify Firebase token
    console.log("[middleware] Verifying Firebase token...");
    const decoded = await verifyAuthToken(idToken);
    const userId = decoded.uid;
    console.log("[middleware] Firebase user:", userId);

    // 3. Get connectionRef from body, query, or header
    const connectionRef =
      req.body?.connectionRef ??
      req.query.connectionRef ??
      (req.headers["x-connection-ref"] as string);

    if (!connectionRef) {
      console.log("[middleware] No connectionRef found in request");
      res.status(400).json({
        error: "Missing connectionRef (in body, query param, or X-Connection-Ref header)",
      });
      return;
    }

    console.log("[middleware] Looking up token for connection:", connectionRef);

    // 4. Look up Tradovate token from Firebase RTDB
    const connection = await getConnectionToken(userId, connectionRef as string);
    console.log("[middleware] Got Tradovate token, url:", connection.url);

    // Decode the Tradovate JWT payload (not verified, just to inspect)
    try {
      const parts = connection.token.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        console.log("[middleware] Tradovate JWT payload:", JSON.stringify(payload));
      }
    } catch {
      console.log("[middleware] Could not decode Tradovate JWT");
    }

    // 5. Create TradovateAuth instance using stored token and URL
    // connection.url is like "https://demo.tradovateapi.com"
    const baseUrl = connection.url.endsWith("/v1")
      ? connection.url
      : `${connection.url}/v1`;

    const auth = TradovateAuth.fromToken(baseUrl, connection.token);

    // Attach to request
    (req as any).tradovateAuth = auth;
    (req as any).userId = userId;
    (req as any).connectionRef = connectionRef;

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    console.error("[middleware] Error:", message);

    if (message.includes("Firebase ID token has expired") || message.includes("Decoding Firebase")) {
      res.status(401).json({ error: "Invalid or expired auth token" });
    } else if (message.includes("No Tradovate token found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
}
