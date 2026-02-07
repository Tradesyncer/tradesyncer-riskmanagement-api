import { Router, Request, Response } from "express";
import { TradovateAuth } from "../../lib/auth";
import { setAutoLiqSettings, UserAccountAutoLiq } from "../../lib/risk";

const router = Router();

// Helper to detect expired Tradovate token errors
function isTradovateTokenExpired(message: string): boolean {
  return message.includes("401") && message.includes("Access is denied");
}

/**
 * Safely fetch from an endpoint, returning null on 401.
 */
async function safeGet<T>(auth: TradovateAuth, endpoint: string, params: Record<string, string>): Promise<T | null> {
  try {
    return await auth.get<T>(endpoint, params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("401") || msg.includes("Access is denied")) {
      return null;
    }
    throw err;
  }
}

/**
 * GET /risk/:accountId
 * Get current auto-liq settings for an account.
 * Fetches BOTH owner and permissioned endpoints and merges them,
 * because DLL/DPT may be on the permissioned entity while trailing
 * drawdown etc. are on the owner entity.
 */
router.get("/:accountId", async (req: Request, res: Response) => {
  try {
    const auth: TradovateAuth = (req as any).tradovateAuth;
    const accountId = parseInt(req.params.accountId as string, 10);

    if (isNaN(accountId)) {
      res.status(400).json({ success: false, error: "Invalid account ID" });
      return;
    }

    const params = { masterid: String(accountId) };

    // Fetch both in parallel -- either may fail with 401 depending on permissions
    const [ownerList, permList] = await Promise.all([
      safeGet<UserAccountAutoLiq[]>(auth, "/userAccountAutoLiq/deps", params),
      safeGet<UserAccountAutoLiq[]>(auth, "/permissionedAccountAutoLiq/deps", params),
    ]);

    const owner = ownerList?.[0] ?? null;
    const perm = permList?.[0] ?? null;

    console.log(`[risk] account ${accountId}: owner=${owner ? 'yes' : 'no'}, permissioned=${perm ? 'yes' : 'no'}`);

    if (!owner && !perm) {
      res.json({ success: true, settings: null });
      return;
    }

    // Merge: permissioned values take priority for DLL/DPT,
    // owner values for trailing drawdown etc.
    res.json({
      success: true,
      settings: {
        dailyLossAutoLiq: perm?.dailyLossAutoLiq ?? owner?.dailyLossAutoLiq,
        dailyProfitAutoLiq: perm?.dailyProfitAutoLiq ?? owner?.dailyProfitAutoLiq,
        weeklyLossAutoLiq: perm?.weeklyLossAutoLiq ?? owner?.weeklyLossAutoLiq,
        weeklyProfitAutoLiq: perm?.weeklyProfitAutoLiq ?? owner?.weeklyProfitAutoLiq,
        trailingMaxDrawdown: owner?.trailingMaxDrawdown ?? perm?.trailingMaxDrawdown,
        trailingMaxDrawdownLimit: owner?.trailingMaxDrawdownLimit,
        trailingMaxDrawdownMode: owner?.trailingMaxDrawdownMode,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`GET /risk/${req.params.accountId} error:`, message);

    if (isTradovateTokenExpired(message)) {
      res.status(401).json({
        success: false,
        error: "Tradovate token expired. Please reconnect your Tradovate connection.",
        code: "TOKEN_EXPIRED",
      });
      return;
    }

    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /risk/:accountId
 * Set auto-liq parameters for an account.
 *
 * Body (all fields optional):
 *   - dailyLossAutoLiq: number     ($ daily loss limit)
 *   - dailyProfitAutoLiq: number   ($ daily profit target)
 *   - weeklyLossAutoLiq: number    ($ weekly loss limit)
 *   - dailyLossAlert: number       ($ daily loss alert)
 *   - dailyLossLiqOnly: number     ($ daily loss liq-only)
 *   - marginPercentageAutoLiq: number
 */
router.post("/:accountId", async (req: Request, res: Response) => {
  try {
    const auth: TradovateAuth = (req as any).tradovateAuth;
    const accountId = parseInt(req.params.accountId as string, 10);

    if (isNaN(accountId)) {
      res.status(400).json({ success: false, error: "Invalid account ID" });
      return;
    }

    // Only forward fields that are valid for PermissionedAccountAutoLiq
    const allowedFields = [
      "dailyLossAutoLiq",
      "dailyProfitAutoLiq",
      "weeklyLossAutoLiq",
      "weeklyProfitAutoLiq",
      "dailyLossAlert",
      "dailyLossPercentageAlert",
      "marginPercentageAlert",
      "dailyLossLiqOnly",
      "dailyLossPercentageLiqOnly",
      "marginPercentageLiqOnly",
      "dailyLossPercentageAutoLiq",
      "marginPercentageAutoLiq",
    ];

    const settings: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] != null) {
        settings[field] = req.body[field];
      }
    }

    if (Object.keys(settings).length === 0) {
      res.status(400).json({
        success: false,
        error: "No valid risk parameters provided",
      });
      return;
    }

    const result = await setAutoLiqSettings(auth, accountId, settings);

    // Extract the settings from the response (handles both owner and permissioned)
    const savedSettings =
      result?.userAccountAutoLiq ?? result?.permissionedAccountAutoLiq ?? result;

    res.json({
      success: true,
      settings: {
        dailyLossAutoLiq: savedSettings?.dailyLossAutoLiq,
        dailyProfitAutoLiq: savedSettings?.dailyProfitAutoLiq,
        weeklyLossAutoLiq: savedSettings?.weeklyLossAutoLiq,
        weeklyProfitAutoLiq: savedSettings?.weeklyProfitAutoLiq,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`POST /risk/${req.params.accountId} error:`, message);

    if (isTradovateTokenExpired(message)) {
      res.status(401).json({
        success: false,
        error: "Tradovate token expired. Please reconnect your Tradovate connection.",
        code: "TOKEN_EXPIRED",
      });
      return;
    }

    res.status(500).json({ success: false, error: message });
  }
});

export default router;
