import type Hapi from "@hapi/hapi";
import { SystemRoutes } from "./app/system/routes";
import { AccountsRoutes } from "./app/accounts/routes";
import { RiskRoutes } from "./app/risk/routes";

export default class Router {
  public static async loadRoutes(server: Hapi.Server): Promise<void> {
    await new SystemRoutes().register(server);
    await new AccountsRoutes().register(server);
    await new RiskRoutes().register(server);
  }
}
