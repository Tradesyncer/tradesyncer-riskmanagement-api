import type { ServerRoute } from "@hapi/hapi";
import type { IRiskController } from "./interface";
import { riskRoutes } from "../../routes/risk";

export class RiskController implements IRiskController {
  getRoutes(): ServerRoute[] {
    return riskRoutes;
  }
}
