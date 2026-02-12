import type { ServerRoute } from "@hapi/hapi";
import type { ISystemController } from "./interface";
import { systemRoutes } from "../../routes/system";

export class SystemController implements ISystemController {
  getRoutes(): ServerRoute[] {
    return systemRoutes;
  }
}
