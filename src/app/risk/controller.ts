import Hapi from '@hapi/hapi';
import { getCachedRisk, invalidateCachedRisk, setCachedRisk } from '../../lib/cache';
import { getAutoLiqSettings, setAutoLiqSettings } from '../../lib/risk';
import { IGetRiskRequest, ISetRiskPayload, ISetRiskRequest } from './interface';
import { getConnectionToken } from '../../lib/supabase';
import { TradovateAuth } from '../../lib/auth';
import { logger } from '../../lib/grafana';

export class RiskController {

  constructor() { }

  public async get(request: IGetRiskRequest, h: Hapi.ResponseToolkit) {
    const { uid } = request.auth.credentials;
    if (!uid) {
      return h.response({ success: false, error: "Unauthorized" }).code(401);
    }
    try {
      const { accountId } = request.params;
      const { connectionRef } = request.query;

      const cached = await getCachedRisk(accountId);
      if (cached) {
        logger.info(`Cache HIT for account ${accountId}`, { uid, accountId });
        return { success: true, autoLiq: cached, cached: true };
      }

      const connection = await getConnectionToken(uid, connectionRef);
      // 5. Create TradovateAuth instance
      const baseUrl = connection.url.endsWith("/v1")
        ? connection.url
        : `${connection.url}/v1`;

      const auth = TradovateAuth.fromToken(baseUrl, connection.token);

      // const auth = getAuth(request);
      const settings = await getAutoLiqSettings(auth, accountId);
      const autoLiq = settings[0] ?? null;

      if (autoLiq) {
        await setCachedRisk(accountId, autoLiq);
        logger.info(`Cache SET for account ${accountId}`, { uid, accountId });
      }

      return { success: true, autoLiq, cached: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(`GET /risk-management/risk/${request.params.accountId} error: ${message}`, { uid, accountId: request.params.accountId });

      if (message.includes("401") || message.includes("Access is denied")) {
        return h.response({ success: false, error: "Tradovate token expired. Please reconnect.", code: "TOKEN_EXPIRED" }).code(401);
      }
      return h.response({ success: false, error: message }).code(500);
    }
  }

  public async set(request: ISetRiskRequest, h: Hapi.ResponseToolkit) {
    const { uid } = request.auth.credentials;
    if (!uid) {
      return h.response({ success: false, error: "Unauthorized" }).code(401);
    }
    try {
      const { accountId } = request.params;
      const payload = request.payload;

      const connection = await getConnectionToken(uid, payload.connectionRef);
      // 5. Create TradovateAuth instance
      const baseUrl = connection.url.endsWith("/v1")
        ? connection.url
        : `${connection.url}/v1`;

      const auth = TradovateAuth.fromToken(baseUrl, connection.token);

      const allowedFields = [
        "dailyLossAutoLiq",
        "dailyProfitAutoLiq",
        "weeklyLossAutoLiq",
        "weeklyProfitAutoLiq",
        "dailyLossAlert",
        "dailyLossPercentageAlert",
        "marginPercentageAlert",
        "dailyLossLiqOnly",
        "dailyLossPercentageLiqOnly",
        "marginPercentageLiqOnly",
        "dailyLossPercentageAutoLiq",
        "marginPercentageAutoLiq",
      ];

      const settings: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in payload) {
          settings[field] = payload[field as keyof ISetRiskPayload] ?? null;
        }
      }

      if (Object.keys(settings).length === 0) {
        return h
          .response({ success: false, error: "No valid risk parameters provided. Include at least one of: dailyLossAutoLiq, dailyProfitAutoLiq, etc." })
          .code(400);
      }

      const result = await setAutoLiqSettings(auth, accountId, settings);

      await invalidateCachedRisk(accountId);
      await setCachedRisk(accountId, result);
      logger.info(`Risk settings updated for account ${accountId}`, { uid, accountId, settings });

      return { success: true, autoLiq: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(`PUT /risk-management/risk/${request.params.accountId} error: ${message}`, { uid, accountId: request.params.accountId });

      if (message.includes("401") || message.includes("Access is denied")) {
        return h
          .response({ success: false, error: "Tradovate token expired. Please reconnect.", code: "TOKEN_EXPIRED" })
          .code(401);
      }

      if (message.includes("Should be account owner")) {
        return h
          .response({ success: false, error: "Insufficient permissions. You are not the account owner.", code: "NOT_OWNER" })
          .code(403);
      }

      return h.response({ success: false, error: message }).code(500);
    }
  }

}
