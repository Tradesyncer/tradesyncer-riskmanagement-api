import type Hapi from "@hapi/hapi";
import { RiskController } from "./controller";

export class RiskRoutes {
  public async register(server: Hapi.Server): Promise<void> {
    const controller = new RiskController();
    server.route(controller.getRoutes());
  }
}
