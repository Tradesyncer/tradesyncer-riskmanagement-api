import type Hapi from "@hapi/hapi";
import { AccountsController } from "./controller";

export class AccountsRoutes {
  public async register(server: Hapi.Server): Promise<void> {
    const controller = new AccountsController();
    server.route(controller.getRoutes());
  }
}
