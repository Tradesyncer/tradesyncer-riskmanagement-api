import type { IRouteController } from "../shared/interface";
import type { Account } from "../../lib/accounts";
import type { IApiErrorResponse } from "../shared/interface";

export interface IAccountsController extends IRouteController {}

export interface IAccountsQuery {
  connectionRef: string;
}

export interface IAccountsResponse {
  success: true;
  accounts: Account[];
}

export type IAccountsErrorResponse = IApiErrorResponse;
