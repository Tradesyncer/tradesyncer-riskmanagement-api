import type { IRouteController } from "../shared/interface";
import type { UserAccountAutoLiq } from "../../lib/risk";
import type { IApiErrorResponse } from "../shared/interface";

export interface IRiskController extends IRouteController {}

export interface IRiskParams {
  accountId: number;
}

export interface IRiskQuery {
  connectionRef: string;
}

export interface ISetRiskPayload {
  connectionRef: string;
  dailyLossAutoLiq?: number;
  dailyProfitAutoLiq?: number;
  weeklyLossAutoLiq?: number;
  weeklyProfitAutoLiq?: number;
  dailyLossAlert?: number;
  dailyLossPercentageAlert?: number;
  marginPercentageAlert?: number;
  dailyLossLiqOnly?: number;
  dailyLossPercentageLiqOnly?: number;
  marginPercentageLiqOnly?: number;
  dailyLossPercentageAutoLiq?: number;
  marginPercentageAutoLiq?: number;
}

export interface IRiskGetResponse {
  success: true;
  autoLiq: UserAccountAutoLiq | null;
  cached: boolean;
}

export interface IRiskSetResponse {
  success: true;
  autoLiq: UserAccountAutoLiq;
}

export type IRiskErrorResponse = IApiErrorResponse;
