import Hapi from "@hapi/hapi";
import { TradovateAuth } from "./auth";
import { verifyAuthToken } from "./firebase";
import { getConnectionToken } from "./supabase";

/**
 * Hapi auth plugin: verifies Firebase ID token, then looks up the
 * Tradovate access token from Supabase based on connectionRef.
 */
export const authPlugin: Hapi.Plugin<void> = {
  name: "firebase-tradovate-auth",
  version: "1.0.0",
  register: async (server: Hapi.Server) => {
    server.auth.scheme("firebase-tradovate", () => ({
      authenticate: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => {
        try {
          // 1. Extract Firebase ID token
          const authHeader = request.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return h
              .response({ error: "Missing Authorization: Bearer <firebase_id_token>" })
              .code(401)
              .takeover();
          }

          const idToken = authHeader.slice(7);
          if (!idToken) {
            return h
              .response({ error: "Empty auth token" })
              .code(401)
              .takeover();
          }

          // 2. Verify Firebase token
          const decoded = await verifyAuthToken(idToken);
          const userId = decoded.uid;

          // 3. Get connectionRef from payload, query, or header
          const payload = request.payload as Record<string, unknown> | null;
          const connectionRef =
            payload?.connectionRef ??
            request.query.connectionRef ??
            request.headers["x-connection-ref"];

          if (!connectionRef) {
            return h
              .response({
                error: "Missing connectionRef (in payload, query param, or X-Connection-Ref header)",
              })
              .code(400)
              .takeover();
          }

          // 4. Look up Tradovate token from Supabase
          const connection = await getConnectionToken(userId, connectionRef as string);

          // 5. Create TradovateAuth instance
          const baseUrl = connection.url.endsWith("/v1")
            ? connection.url
            : `${connection.url}/v1`;

          const auth = TradovateAuth.fromToken(baseUrl, connection.token);

          // Return credentials for use in route handlers
          return h.authenticated({
            credentials: {
              userId,
              connectionRef: connectionRef as string,
              tradovateAuth: auth,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Authentication failed";
          console.error("[auth] Error:", message);

          if (message.includes("Firebase ID token has expired") || message.includes("Decoding Firebase")) {
            return h.response({ error: "Invalid or expired auth token" }).code(401).takeover();
          } else if (message.includes("No Tradovate token found")) {
            return h.response({ error: message }).code(404).takeover();
          }

          return h.response({ error: message }).code(401).takeover();
        }
      },
    }));

    server.auth.strategy("firebase", "firebase-tradovate");
  },
};
