import type Hapi from "@hapi/hapi";
import { SystemController } from "./controller";

export class SystemRoutes {
  public async register(server: Hapi.Server): Promise<void> {
    const controller = new SystemController();
    server.route(controller.getRoutes());
  }
}
