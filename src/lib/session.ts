import { TradovateAuth } from "./auth";
import { getBaseUrl, type Environment } from "./config";

/**
 * Server-side singleton for the Tradovate auth session.
 */

let authInstance: TradovateAuth | null = null;

/** Create an auth instance from an access token. */
export function setAuthFromToken(accessToken: string, env?: Environment): TradovateAuth {
  const baseUrl = getBaseUrl(env ?? "demo");
  authInstance = TradovateAuth.fromToken(baseUrl, accessToken);
  return authInstance;
}

export function getAuthInstance(): TradovateAuth {
  if (!authInstance) {
    throw new Error("Not connected. Please provide an access token first.");
  }
  return authInstance;
}

export function clearAuthInstance(): void {
  authInstance = null;
}

export function isAuthenticated(): boolean {
  return authInstance !== null;
}
