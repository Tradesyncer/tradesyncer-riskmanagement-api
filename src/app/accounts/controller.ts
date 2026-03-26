import Hapi from '@hapi/hapi';
import { IGetAccountsRequest } from './interface';
import { getConnectionToken } from '../../lib/supabase';
import { TradovateAuth } from '../../lib/auth';
import { listAccounts } from '../../lib/accounts';
import { logger } from '../../lib/grafana';

export class AccountsController {

  constructor() { }

  public async get(request: IGetAccountsRequest, h: Hapi.ResponseToolkit) {
    const { uid } = request.auth.credentials;
    if (!uid) {
      return h.response({ success: false, error: "Unauthorized" }).code(401);
    }
    try {
      const { connectionRef } = request.query;
      const connection = await getConnectionToken(uid, connectionRef);
      // 5. Create TradovateAuth instance
      const baseUrl = connection.url.endsWith("/v1")
        ? connection.url
        : `${connection.url}/v1`;

      const auth = TradovateAuth.fromToken(baseUrl, connection.token);
      const accounts = await listAccounts(auth);
      return { success: true, accounts };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(`GET /risk-management/accounts error: ${message}`, { uid });

      if (message.includes("401") || message.includes("Access is denied")) {
        return h.response({ success: false, error: "Tradovate token expired. Please reconnect.", code: "TOKEN_EXPIRED" }).code(401);
      }
      return h.response({ success: false, error: message }).code(500);
    }
  }

}
