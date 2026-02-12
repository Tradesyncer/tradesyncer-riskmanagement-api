import type { ServerRoute } from "@hapi/hapi";

export interface IRouteController {
  getRoutes(): ServerRoute[];
}

export interface IApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}
