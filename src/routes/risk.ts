import type { Request, ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { TradovateAuth } from "../lib/auth";
import { getAutoLiqSettings, setAutoLiqSettings } from "../lib/risk";
import { getCachedRisk, invalidateCachedRisk, setCachedRisk } from "../lib/cache";

function getAuth(request: Request): TradovateAuth {
  return (request.auth.credentials as { tradovateAuth: TradovateAuth }).tradovateAuth;
}

const ErrorSchema = Joi.object({
  success: Joi.boolean().example(false),
  error: Joi.string().example("Error description"),
  code: Joi.string().optional().example("TOKEN_EXPIRED"),
}).label("ErrorResponse");

const AutoLiqSchema = Joi.object({
  id: Joi.number().integer().example(37857980),
  dailyLossAutoLiq: Joi.number().allow(null).example(500),
  dailyProfitAutoLiq: Joi.number().allow(null).example(1000),
  weeklyLossAutoLiq: Joi.number().allow(null).optional(),
  weeklyProfitAutoLiq: Joi.number().allow(null).optional(),
  dailyLossAlert: Joi.number().allow(null).optional(),
  dailyLossPercentageAlert: Joi.number().allow(null).optional(),
  marginPercentageAlert: Joi.number().allow(null).optional(),
  dailyLossLiqOnly: Joi.number().allow(null).optional(),
  dailyLossPercentageLiqOnly: Joi.number().allow(null).optional(),
  marginPercentageLiqOnly: Joi.number().allow(null).optional(),
  dailyLossPercentageAutoLiq: Joi.number().allow(null).optional(),
  marginPercentageAutoLiq: Joi.number().allow(null).optional(),
  trailingMaxDrawdown: Joi.number().allow(null).optional(),
  trailingMaxDrawdownLimit: Joi.number().allow(null).optional(),
  trailingMaxDrawdownMode: Joi.string().valid("EOD", "RealTime").allow(null).optional(),
  flattenTimestamp: Joi.string().allow(null).optional(),
  doNotUnlock: Joi.boolean().allow(null).optional(),
  changesLocked: Joi.boolean().allow(null).optional(),
}).unknown(true).label("AutoLiqSettings");

export const riskRoutes: ServerRoute[] = [
  {
    method: "GET",
    path: "/risk-management/risk/{accountId}",
    options: {
      auth: "firebase",
      tags: ["api", "Risk"],
      description: "Get current risk settings",
      notes:
        "Returns the current auto-liquidation settings (DLL, DPT, trailing drawdown, etc.) for a specific account.",
      validate: {
        params: Joi.object({
          accountId: Joi.number()
            .integer()
            .required()
            .description("Tradovate account ID"),
        }),
        query: Joi.object({
          connectionRef: Joi.string()
            .required()
            .description("Tradovate connection reference"),
        }),
        headers: Joi.object({
          authorization: Joi.string()
            .required()
            .description("Bearer <firebase_id_token>"),
        }).unknown(true),
      },
      response: {
        status: {
          200: Joi.object({
            success: Joi.boolean().example(true),
            autoLiq: AutoLiqSchema.allow(null),
            cached: Joi.boolean().example(false),
          }).label("RiskGetResponse"),
          400: ErrorSchema,
          401: ErrorSchema,
          404: ErrorSchema,
          500: ErrorSchema,
        },
        options: { stripUnknown: false },
      },
    },
    handler: async (request, h) => {
      try {
        const accountId = request.params.accountId as number;

        const cached = getCachedRisk(accountId);
        if (cached) {
          console.log(`[cache] HIT for account ${accountId}`);
          return { success: true, autoLiq: cached, cached: true };
        }

        const auth = getAuth(request);
        const settings = await getAutoLiqSettings(auth, accountId);
        const autoLiq = settings[0] ?? null;

        if (autoLiq) {
          setCachedRisk(accountId, autoLiq);
          console.log(`[cache] SET for account ${accountId}`);
        }

        return { success: true, autoLiq, cached: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`GET /risk-management/risk/${request.params.accountId} error:`, message);

        if (message.includes("401") || message.includes("Access is denied")) {
          return h.response({ success: false, error: "Tradovate token expired. Please reconnect.", code: "TOKEN_EXPIRED" }).code(401);
        }
        return h.response({ success: false, error: message }).code(500);
      }
    },
  },
  {
    method: "PUT",
    path: "/risk-management/risk/{accountId}",
    options: {
      auth: "firebase",
      tags: ["api", "Risk"],
      description: "Set risk limits",
      notes:
        "Set daily loss limit (DLL), daily profit target (DPT), and other auto-liquidation parameters for a specific account.",
      validate: {
        params: Joi.object({
          accountId: Joi.number()
            .integer()
            .required()
            .description("Tradovate account ID"),
        }),
        payload: Joi.object({
          connectionRef: Joi.string()
            .required()
            .description("Tradovate connection reference")
            .example("TS-447E7D"),
          dailyLossAutoLiq: Joi.number()
            .optional()
            .description("$ Daily Loss Limit - triggers auto-liquidation when daily loss reaches this amount")
            .example(500),
          dailyProfitAutoLiq: Joi.number()
            .optional()
            .description("$ Daily Profit Target - triggers auto-liquidation when daily profit reaches this amount")
            .example(1000),
          weeklyLossAutoLiq: Joi.number()
            .optional()
            .description("$ Weekly Loss Limit"),
          weeklyProfitAutoLiq: Joi.number()
            .optional()
            .description("$ Weekly Profit Target"),
          dailyLossAlert: Joi.number()
            .optional()
            .description("$ Daily Loss Alert threshold"),
          dailyLossPercentageAlert: Joi.number()
            .optional()
            .description("Daily Loss % for Alert"),
          marginPercentageAlert: Joi.number()
            .optional()
            .description("Margin % for Alert"),
          dailyLossLiqOnly: Joi.number()
            .optional()
            .description("$ Daily Loss for Liquidate-Only mode"),
          dailyLossPercentageLiqOnly: Joi.number()
            .optional()
            .description("Daily Loss % for Liq-Only"),
          marginPercentageLiqOnly: Joi.number()
            .optional()
            .description("Margin % for Liq-Only"),
          dailyLossPercentageAutoLiq: Joi.number()
            .optional()
            .description("Daily Loss % for Auto-Liq"),
          marginPercentageAutoLiq: Joi.number()
            .optional()
            .description("Margin % for Auto-Liq"),
        }).label("SetRiskPayload"),
        headers: Joi.object({
          authorization: Joi.string()
            .required()
            .description("Bearer <firebase_id_token>"),
        }).unknown(true),
      },
      response: {
        status: {
          200: Joi.object({
            success: Joi.boolean().example(true),
            autoLiq: AutoLiqSchema,
          }).label("RiskSetResponse"),
          400: ErrorSchema,
          401: ErrorSchema,
          404: ErrorSchema,
          500: ErrorSchema,
        },
      },
    },
    handler: async (request, h) => {
      try {
        const auth = getAuth(request);
        const accountId = request.params.accountId as number;
        const payload = request.payload as Record<string, unknown>;

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
          if (payload[field] != null) {
            settings[field] = payload[field];
          }
        }

        if (Object.keys(settings).length === 0) {
          return h
            .response({ success: false, error: "No valid risk parameters provided. Include at least one of: dailyLossAutoLiq, dailyProfitAutoLiq, etc." })
            .code(400);
        }

        const result = await setAutoLiqSettings(auth, accountId, settings);

        invalidateCachedRisk(accountId);
        setCachedRisk(accountId, result);
        console.log(`[cache] UPDATED for account ${accountId}`);

        return { success: true, autoLiq: result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`POST /risk-management/risk/${request.params.accountId} error:`, message);

        if (message.includes("401") || message.includes("Access is denied")) {
          return h
            .response({ success: false, error: "Tradovate token expired. Please reconnect.", code: "TOKEN_EXPIRED" })
            .code(401);
        }

        if (message.includes("Unsupported parameters")) {
          return h
            .response({ success: false, error: message, code: "UNSUPPORTED_PARAMS" })
            .code(400);
        }

        if (message.includes("Should be account owner")) {
          return h
            .response({ success: false, error: "Insufficient permissions. You are not the account owner.", code: "NOT_OWNER" })
            .code(403);
        }

        return h.response({ success: false, error: message }).code(500);
      }
    },
  },
];
