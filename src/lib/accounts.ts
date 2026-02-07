import { TradovateAuth } from "./auth";

export interface Account {
  id: number;
  name: string;
  userId: number;
  accountType: string;
  active: boolean;
  clearingHouseId: number;
  riskCategoryId: number;
  autoLiqProfileId: number;
  marginAccountType: string;
  legalStatus: string;
  timestamp?: string;
  readonly?: boolean;
}

/** Fetch all accounts for the authenticated user. */
export async function listAccounts(auth: TradovateAuth): Promise<Account[]> {
  return auth.get<Account[]>("/account/list");
}

/** Fetch a single account by its ID. */
export async function getAccount(
  auth: TradovateAuth,
  id: number
): Promise<Account> {
  return auth.get<Account>("/account/item", { id: String(id) });
}
