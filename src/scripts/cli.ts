import { parseArgs } from "node:util";
import { getCredentials, getEnvironment, getBaseUrl } from "../lib/config";
import { TradovateAuth } from "../lib/auth";
import { listAccounts } from "../lib/accounts";
import {
  getAutoLiqSettings,
  setDailyLimits,
  formatAutoLiqSettings,
} from "../lib/risk";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
Tradovate Risk Management CLI
==============================

Usage:
  npx tsx src/main.ts --daily-loss <amount> --daily-profit <amount> [options]

Options:
  --daily-loss    <number>   Daily loss limit in dollars (triggers auto-liq)
  --daily-profit  <number>   Daily profit target in dollars (triggers auto-liq)
  --account-id    <number>   Target a specific account ID (otherwise all accounts)
  --no-lock                  Allow account to unlock after trigger (default: stays closed)
  --view                     View current auto-liq settings without changing them
  --help                     Show this help message

Environment:
  Configure credentials in .env (copy .env.example to .env).
  Set TRADOVATE_ENV=live or TRADOVATE_ENV=demo to choose the API server.

Examples:
  # Set $500 daily loss limit and $1000 daily profit target on all accounts
  npx tsx src/main.ts --daily-loss 500 --daily-profit 1000

  # View current settings
  npx tsx src/main.ts --view

  # Set limits on a specific account
  npx tsx src/main.ts --daily-loss 500 --daily-profit 1000 --account-id 12345
`);
}

async function main(): Promise<void> {
  // Parse CLI args
  const { values } = parseArgs({
    options: {
      "daily-loss": { type: "string" },
      "daily-profit": { type: "string" },
      "account-id": { type: "string" },
      "no-lock": { type: "boolean", default: false },
      view: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const viewOnly = values.view ?? false;
  const dailyLoss = values["daily-loss"]
    ? Number(values["daily-loss"])
    : undefined;
  const dailyProfit = values["daily-profit"]
    ? Number(values["daily-profit"])
    : undefined;
  const targetAccountId = values["account-id"]
    ? Number(values["account-id"])
    : undefined;
  const keepClosed = !(values["no-lock"] ?? false);

  if (!viewOnly && (dailyLoss == null || dailyProfit == null)) {
    console.error(
      "Error: --daily-loss and --daily-profit are required (or use --view)."
    );
    printUsage();
    process.exit(1);
  }

  if (dailyLoss != null && (isNaN(dailyLoss) || dailyLoss <= 0)) {
    console.error("Error: --daily-loss must be a positive number.");
    process.exit(1);
  }

  if (dailyProfit != null && (isNaN(dailyProfit) || dailyProfit <= 0)) {
    console.error("Error: --daily-profit must be a positive number.");
    process.exit(1);
  }

  // Setup
  const env = getEnvironment();
  const baseUrl = getBaseUrl(env);
  const credentials = getCredentials();

  console.log(`\nEnvironment: ${env.toUpperCase()}`);
  console.log(`API URL:     ${baseUrl}\n`);

  // Authenticate
  const auth = new TradovateAuth(baseUrl, credentials);
  await auth.authenticate();

  // Fetch accounts
  const accounts = await listAccounts(auth);
  console.log(`\nFound ${accounts.length} account(s):\n`);

  for (const acct of accounts) {
    console.log(
      `  [${acct.id}] ${acct.name} — ${acct.accountType}, active=${acct.active}`
    );
  }

  // Filter to target account(s)
  const targetAccounts = targetAccountId
    ? accounts.filter((a) => a.id === targetAccountId)
    : accounts.filter((a) => a.active);

  if (targetAccounts.length === 0) {
    console.error(
      targetAccountId
        ? `\nError: Account ID ${targetAccountId} not found.`
        : "\nError: No active accounts found."
    );
    process.exit(1);
  }

  // Process each account
  for (const acct of targetAccounts) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Account: ${acct.name} (ID: ${acct.id})`);
    console.log("=".repeat(60));

    // Show current settings
    const currentSettings = await getAutoLiqSettings(auth, acct.id);
    if (currentSettings.length > 0) {
      console.log("\nCurrent auto-liq settings:");
      for (const s of currentSettings) {
        console.log(formatAutoLiqSettings(s));
      }
    } else {
      console.log("\nNo existing auto-liq settings.");
    }

    // Apply new settings
    if (!viewOnly && dailyLoss != null && dailyProfit != null) {
      console.log("\nApplying new settings...");
      const updated = await setDailyLimits(
        auth,
        acct.id,
        dailyLoss,
        dailyProfit,
        keepClosed
      );
      console.log("\nUpdated auto-liq settings:");
      console.log(formatAutoLiqSettings(updated));
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFatal error:", err.message ?? err);
  process.exit(1);
});
