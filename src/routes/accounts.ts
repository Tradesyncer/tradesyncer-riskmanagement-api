import type { Request, ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { TradovateAuth } from "../lib/auth";
import { listAccounts } from "../lib/accounts";

function getAuth(request: Request): TradovateAuth {
  return (request.auth.credentials as { tradovateAuth: TradovateAuth }).tradovateAuth;
}

const ErrorSchema = Joi.object({
  success: Joi.boolean().example(false),
  error: Joi.string().example("Error description"),
  code: Joi.string().optional().example("TOKEN_EXPIRED"),
}).label("ErrorResponse");

const AccountSchema = Joi.object({
  id: Joi.number().integer().example(37857980),
  name: Joi.string().example("MFFUEVPRO203682060"),
  userId: Joi.number().integer().example(150234),
  accountType: Joi.string().example("Customer"),
  active: Joi.boolean().example(true),
  clearingHouseId: Joi.number().integer().optional(),
  riskCategoryId: Joi.number().integer().optional(),
  autoLiqProfileId: Joi.number().integer().optional(),
  marginAccountType: Joi.string().optional().example("Speculator"),
  legalStatus: Joi.string().optional().example("Individual"),
}).label("Account");

export const accountsRoutes: ServerRoute[] = [
  {
    method: "GET",
    path: "/risk-management/accounts",
    options: {
      auth: "firebase",
      tags: ["api", "Accounts"],
      description: "List Tradovate accounts",
      notes:
        "Returns all accounts accessible by the authenticated user's Tradovate connection.",
      validate: {
        query: Joi.object({
          connectionRef: Joi.string()
            .required()
            .description("Tradovate connection reference (e.g. TS-447E7D)"),
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
            accounts: Joi.array().items(AccountSchema),
          }).label("AccountsResponse"),
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
        const accounts = await listAccounts(auth);
        return { success: true, accounts };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("GET /risk-management/accounts error:", message);

        if (message.includes("401") || message.includes("Access is denied")) {
          return h.response({ success: false, error: "Tradovate token expired. Please reconnect.", code: "TOKEN_EXPIRED" }).code(401);
        }
        return h.response({ success: false, error: message }).code(500);
      }
    },
  },
];
