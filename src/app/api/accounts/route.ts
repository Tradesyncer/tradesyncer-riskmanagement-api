import { NextResponse } from "next/server";
import { getAuthInstance } from "@/lib/session";
import { listAccounts } from "@/lib/accounts";
import { getAutoLiqSettings } from "@/lib/risk";

export async function GET() {
  try {
    const auth = await getAuthInstance();
    const accounts = await listAccounts(auth);

    // Enrich each account with its current auto-liq settings
    const enriched = await Promise.all(
      accounts.map(async (acct) => {
        try {
          const autoLiq = await getAutoLiqSettings(auth, acct.id);
          return { ...acct, autoLiq: autoLiq[0] ?? null };
        } catch {
          return { ...acct, autoLiq: null };
        }
      })
    );

    return NextResponse.json({ success: true, accounts: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
