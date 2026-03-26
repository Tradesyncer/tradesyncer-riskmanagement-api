import { logger } from "./grafana";

const P_TICKET_MAX_ATTEMPTS = 20;
const P_TICKET_DEFAULT_WAIT = 3;

export class TradovateAuth {
  private accessToken: string | null = null;

  constructor(private baseUrl: string) {}

  static fromToken(baseUrl: string, accessToken: string): TradovateAuth {
    const auth = new TradovateAuth(baseUrl);
    auth.accessToken = accessToken;
    return auth;
  }

  async getToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error("Not authenticated. No access token available.");
    }
    return this.accessToken;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getToken();
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const start = Date.now();
    logger.info(`Tradovate API → GET ${endpoint}`, { params });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const elapsed = Date.now() - start;

    if (!response.ok) {
      const text = await response.text();
      logger.error(`Tradovate API ← GET ${endpoint} ${response.status} (${elapsed}ms)`, { body: text });
      throw new Error(`GET ${endpoint} failed (${response.status}): ${text}`);
    }

    const json = await response.json() as T;
    logger.info(`Tradovate API ← GET ${endpoint} ${response.status} (${elapsed}ms)`);
    return json;
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const token = await this.getToken();
    const url = `${this.baseUrl}${endpoint}`;

    const start = Date.now();
    logger.info(`Tradovate API → POST ${endpoint}`, { body });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const elapsed = Date.now() - start;
    const text = await response.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      if (!response.ok) {
        logger.error(`Tradovate API ← POST ${endpoint} ${response.status} (${elapsed}ms)`, { body: text });
        throw new Error(`POST ${endpoint} failed (${response.status}): ${text}`);
      }
      throw new Error(`POST ${endpoint}: invalid JSON response`);
    }

    // p-ticket handling — Tradovate rate limit with retry
    if (json["p-ticket"]) {
      return this.handlePTicket<T>(endpoint, body, json, token);
    }

    if (!response.ok) {
      logger.error(`Tradovate API ← POST ${endpoint} ${response.status} (${elapsed}ms)`, { response: json });
      throw new Error(`POST ${endpoint} failed (${response.status}): ${text}`);
    }

    logger.info(`Tradovate API ← POST ${endpoint} ${response.status} (${elapsed}ms)`);
    return json as T;
  }

  private async handlePTicket<T>(
    endpoint: string,
    originalBody: unknown,
    initialResponse: any,
    token: string,
  ): Promise<T> {
    let pTicket = initialResponse["p-ticket"];
    let pTime = initialResponse["p-time"] ?? P_TICKET_DEFAULT_WAIT;
    const pCaptcha = initialResponse["p-captcha"];

    if (pCaptcha) {
      logger.error(`Tradovate p-captcha received for POST ${endpoint} — blocked for ~1 hour`);
      throw new Error(`POST ${endpoint}: p-captcha received. Rate limited for ~1 hour.`);
    }

    for (let attempt = 1; attempt <= P_TICKET_MAX_ATTEMPTS; attempt++) {
      logger.info(`Tradovate p-ticket received, waiting ${pTime}s (attempt ${attempt}/${P_TICKET_MAX_ATTEMPTS})`, {
        endpoint, pTicket, pTime,
      });

      await new Promise((r) => setTimeout(r, pTime * 1000));

      const url = `${this.baseUrl}${endpoint}`;
      const retryBody = { ...(originalBody as any), "p-ticket": pTicket };
      const start = Date.now();

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(retryBody),
      });

      const elapsed = Date.now() - start;
      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        logger.error(`Tradovate p-ticket retry ${attempt} — invalid JSON (${elapsed}ms)`, { body: text });
        throw new Error(`POST ${endpoint} p-ticket retry: invalid JSON`);
      }

      if (json["p-ticket"]) {
        pTicket = json["p-ticket"];
        pTime = json["p-time"] ?? P_TICKET_DEFAULT_WAIT;

        if (json["p-captcha"]) {
          logger.error(`Tradovate p-captcha on retry ${attempt} for POST ${endpoint}`);
          throw new Error(`POST ${endpoint}: p-captcha on retry. Rate limited for ~1 hour.`);
        }
        continue;
      }

      if (!response.ok) {
        logger.error(`Tradovate p-ticket resolved but failed: POST ${endpoint} ${response.status} (${elapsed}ms)`);
        throw new Error(`POST ${endpoint} failed (${response.status}): ${text}`);
      }

      logger.info(`Tradovate p-ticket resolved after ${attempt} attempt(s) for POST ${endpoint} (${elapsed}ms)`);
      return json as T;
    }

    logger.error(`Tradovate p-ticket exhausted ${P_TICKET_MAX_ATTEMPTS} attempts for POST ${endpoint}`);
    throw new Error(`POST ${endpoint}: p-ticket polling exhausted after ${P_TICKET_MAX_ATTEMPTS} attempts`);
  }
}
