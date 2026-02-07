export class TradovateAuth {
  private accessToken: string | null = null;

  constructor(private baseUrl: string) {}

  /** Create an auth instance from an existing OAuth access token. */
  static fromToken(baseUrl: string, accessToken: string): TradovateAuth {
    const auth = new TradovateAuth(baseUrl);
    auth.accessToken = accessToken;
    return auth;
  }

  /** Get the current access token. */
  async getToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error("Not authenticated. No access token available.");
    }
    return this.accessToken;
  }

  /** Make an authenticated GET request. */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getToken();
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GET ${endpoint} failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /** Make an authenticated POST request. */
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const token = await this.getToken();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`POST ${endpoint} failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }
}
