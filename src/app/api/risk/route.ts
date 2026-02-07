import { NextRequest, NextResponse } from "next/server";
import { getAuthInstance } from "@/lib/session";
import { setAutoLiqSettings } from "@/lib/risk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, dailyLossAutoLiq, dailyProfitAutoLiq, doNotUnlock } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "accountId is required" },
        { status: 400 }
      );
    }

    const auth = await getAuthInstance();

    // Only send fields supported by PermissionedAccountAutoLiq.
    // doNotUnlock is only available to account owners, not permissioned users.
    const settings: Record<string, unknown> = {
      accountId,
    };
    if (dailyLossAutoLiq != null) settings.dailyLossAutoLiq = dailyLossAutoLiq;
    if (dailyProfitAutoLiq != null) settings.dailyProfitAutoLiq = dailyProfitAutoLiq;

    const result = await setAutoLiqSettings(auth, accountId, settings);

    return NextResponse.json({ success: true, autoLiq: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
