import type { ServerRoute } from "@hapi/hapi";
import type { IAccountsController } from "./interface";
import { accountsRoutes } from "../../routes/accounts";

export class AccountsController implements IAccountsController {
  getRoutes(): ServerRoute[] {
    return accountsRoutes;
  }
}
