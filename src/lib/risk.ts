import { TradovateAuth } from "./auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserAccountAutoLiq {
  id: number;
  changesLocked?: boolean;
  marginPercentageAlert?: number;
  dailyLossPercentageAlert?: number;
  dailyLossAlert?: number;
  marginPercentageLiqOnly?: number;
  dailyLossPercentageLiqOnly?: number;
  dailyLossLiqOnly?: number;
  marginPercentageAutoLiq?: number;
  dailyLossPercentageAutoLiq?: number;
  dailyLossAutoLiq?: number;
  weeklyLossAutoLiq?: number;
  flattenTimestamp?: string;
  trailingMaxDrawdown?: number;
  trailingMaxDrawdownLimit?: number;
  trailingMaxDrawdownMode?: "EOD" | "RealTime";
  dailyProfitAutoLiq?: number;
  weeklyProfitAutoLiq?: number;
  doNotUnlock?: boolean;
}

export interface UpdateUserAutoLiqResponse {
  errorText?: string;
  userAccountAutoLiq?: UserAccountAutoLiq;
  permissionedAccountAutoLiq?: Record<string, unknown>;
}

export interface AutoLiqSettings {
  dailyLossAutoLiq?: number;
  dailyProfitAutoLiq?: number;
  doNotUnlock?: boolean;
  weeklyLossAutoLiq?: number;
  flattenTimestamp?: string;
  trailingMaxDrawdown?: number;
  trailingMaxDrawdownLimit?: number;
  trailingMaxDrawdownMode?: "EOD" | "RealTime";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get existing auto-liq settings for an account.
 * Returns the settings array (may be empty if none exist).
 */
export async function getAutoLiqSettings(
  auth: TradovateAuth,
  accountId: number
): Promise<UserAccountAutoLiq[]> {
  return auth.get<UserAccountAutoLiq[]>("/userAccountAutoLiq/deps", {
    masterid: String(accountId),
  });
}

/** List all auto-liq settings visible to the user. */
export async function listAllAutoLiqSettings(
  auth: TradovateAuth
): Promise<UserAccountAutoLiq[]> {
  return auth.get<UserAccountAutoLiq[]>("/userAccountAutoLiq/list");
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create or update auto-liq settings for a given account.
 *
 * Uses the higher-level `updateUserAutoLiq` endpoint which handles
 * both creation and updates in one call, keyed by accountId.
 */
export async function setAutoLiqSettings(
  auth: TradovateAuth,
  accountId: number,
  settings: Record<string, unknown>
): Promise<UserAccountAutoLiq> {
  const body = {
    accountId,
    ...settings,
  };

  const result = await auth.post<UpdateUserAutoLiqResponse>(
    "/userAccountAutoLiq/updateuserautoliq",
    body
  );

  if (result.errorText) {
    throw new Error(
      `Failed to set auto-liq for account ${accountId}: ${result.errorText}`
    );
  }

  // Permissioned users get data in permissionedAccountAutoLiq,
  // account owners get it in userAccountAutoLiq.
  const autoLiq = result.userAccountAutoLiq
    ?? (result.permissionedAccountAutoLiq as UserAccountAutoLiq | undefined);

  if (!autoLiq) {
    throw new Error(
      `No auto-liq entity returned for account ${accountId}`
    );
  }

  return autoLiq;
}

/**
 * Convenience: set daily loss limit and daily profit target for an account.
 * When either limit is hit, the account is auto-liquidated and stays closed.
 */
export async function setDailyLimits(
  auth: TradovateAuth,
  accountId: number,
  dailyLossLimit: number,
  dailyProfitTarget: number,
  keepClosed: boolean = true
): Promise<UserAccountAutoLiq> {
  console.log(
    `Setting account ${accountId}: ` +
      `dailyLoss=$${dailyLossLimit}, dailyProfit=$${dailyProfitTarget}, ` +
      `doNotUnlock=${keepClosed}`
  );

  return setAutoLiqSettings(auth, accountId, {
    dailyLossAutoLiq: dailyLossLimit,
    dailyProfitAutoLiq: dailyProfitTarget,
    doNotUnlock: keepClosed,
  });
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatAutoLiqSettings(settings: UserAccountAutoLiq): string {
  const lines: string[] = [
    `  Auto-Liq ID:          ${settings.id}`,
    `  Daily Loss Auto-Liq:  ${settings.dailyLossAutoLiq != null ? "$" + settings.dailyLossAutoLiq : "not set"}`,
    `  Daily Profit Auto-Liq:${settings.dailyProfitAutoLiq != null ? " $" + settings.dailyProfitAutoLiq : " not set"}`,
    `  Weekly Loss Auto-Liq: ${settings.weeklyLossAutoLiq != null ? "$" + settings.weeklyLossAutoLiq : "not set"}`,
    `  Trailing Max Drawdown:${settings.trailingMaxDrawdown != null ? " $" + settings.trailingMaxDrawdown : " not set"}`,
    `  Flatten Timestamp:    ${settings.flattenTimestamp ?? "not set"}`,
    `  Do Not Unlock:        ${settings.doNotUnlock ?? false}`,
    `  Changes Locked:       ${settings.changesLocked ?? false}`,
  ];
  return lines.join("\n");
}
