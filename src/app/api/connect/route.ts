import { NextRequest, NextResponse } from "next/server";
import { setAuthFromToken, isAuthenticated } from "@/lib/session";
import { getEnvironment } from "@/lib/config";

/** POST: Connect using a provided access token */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, environment } = body;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Access token is required" },
        { status: 400 }
      );
    }

    const env = environment || getEnvironment();
    setAuthFromToken(accessToken, env);

    return NextResponse.json({
      success: true,
      environment: env,
      connected: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** GET: Check connection status */
export async function GET() {
  try {
    const env = getEnvironment();
    return NextResponse.json({
      success: true,
      environment: env,
      connected: isAuthenticated(),
    });
  } catch {
    return NextResponse.json({ success: false, connected: false });
  }
}
