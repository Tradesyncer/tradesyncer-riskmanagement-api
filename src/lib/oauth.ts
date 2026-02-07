import { getEnvironment, getBaseUrl } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getCid(): string {
  const cid = process.env.TRADOVATE_CID;
  if (!cid) throw new Error("Missing TRADOVATE_CID");
  return cid;
}

function getSec(): string {
  const sec = process.env.TRADOVATE_SEC;
  if (!sec) throw new Error("Missing TRADOVATE_SEC");
  return sec;
}

function getRedirectUri(): string {
  const uri = process.env.TRADOVATE_REDIRECT_URI;
  if (!uri) throw new Error("Missing TRADOVATE_REDIRECT_URI");
  return uri;
}

// ---------------------------------------------------------------------------
// OAuth URL
// ---------------------------------------------------------------------------

/**
 * Build the Tradovate OAuth authorization URL.
 * Uses https://trader.tradovate.com/oauth -- same as Tradesyncer production.
 */
export function getOAuthLoginUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getCid(),
    redirect_uri: getRedirectUri(),
  });

  return `https://trader.tradovate.com/oauth?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange an OAuth authorization code for an access token.
 * Uses the standard Tradovate API endpoint for token exchange.
 */
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const env = getEnvironment();
  const baseUrl = getBaseUrl(env);
  const url = `${baseUrl}/auth/oauthtoken`;

  const body = {
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: getCid(),
    client_secret: getSec(),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach Tradovate OAuth endpoint: ${detail}`);
  }

  const data = (await response.json()) as OAuthTokenResponse;

  if (data.error) {
    throw new Error(
      `OAuth error: ${data.error} - ${data.error_description ?? "unknown"}`
    );
  }

  if (!data.access_token) {
    throw new Error("No access token returned from OAuth exchange");
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 5400,
  };
}
