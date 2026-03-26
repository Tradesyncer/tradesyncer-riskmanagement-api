import Hapi from '@hapi/hapi';
import Joi from 'joi';
import { RiskController } from './controller';
import { AutoLiqSchema, ErrorSchema } from './interface';

export class RiskRoutes {
  public async register(server: Hapi.Server): Promise<void> {
    return new Promise<void>((resolve) => {

      const controller = new RiskController();
      server.bind(controller);

      server.route([
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
            handler: controller.get,
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
                  .allow(null)
                  .optional()
                  .description("$ Daily Loss Limit — set a value to enable, send null to disable")
                  .example(500),
                dailyProfitAutoLiq: Joi.number()
                  .allow(null)
                  .optional()
                  .description("$ Daily Profit Target — set a value to enable, send null to disable")
                  .example(1000),
                weeklyLossAutoLiq: Joi.number()
                  .allow(null)
                  .optional()
                  .description("$ Weekly Loss Limit — send null to disable"),
                weeklyProfitAutoLiq: Joi.number()
                  .allow(null)
                  .optional()
                  .description("$ Weekly Profit Target — send null to disable"),
                dailyLossAlert: Joi.number()
                  .allow(null)
                  .optional()
                  .description("$ Daily Loss Alert threshold — send null to disable"),
                dailyLossPercentageAlert: Joi.number()
                  .allow(null)
                  .optional()
                  .description("Daily Loss % for Alert — send null to disable"),
                marginPercentageAlert: Joi.number()
                  .allow(null)
                  .optional()
                  .description("Margin % for Alert — send null to disable"),
                dailyLossLiqOnly: Joi.number()
                  .allow(null)
                  .optional()
                  .description("$ Daily Loss for Liquidate-Only mode — send null to disable"),
                dailyLossPercentageLiqOnly: Joi.number()
                  .allow(null)
                  .optional()
                  .description("Daily Loss % for Liq-Only — send null to disable"),
                marginPercentageLiqOnly: Joi.number()
                  .allow(null)
                  .optional()
                  .description("Margin % for Liq-Only — send null to disable"),
                dailyLossPercentageAutoLiq: Joi.number()
                  .allow(null)
                  .optional()
                  .description("Daily Loss % for Auto-Liq — send null to disable"),
                marginPercentageAutoLiq: Joi.number()
                  .allow(null)
                  .optional()
                  .description("Margin % for Auto-Liq — send null to disable"),
              }).label("SetRiskPayload"),
              headers: Joi.object({
                authorization: Joi.string()
                  .required()
                  .description("Bearer <firebase_id_token>"),
              }).unknown(true),
            },
            handler: controller.set,
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
        },
      ]);

      resolve();
    });
  }
}