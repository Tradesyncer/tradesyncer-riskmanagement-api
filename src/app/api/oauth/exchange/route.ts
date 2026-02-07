import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/oauth";
import { setAuthFromToken } from "@/lib/session";
import { getEnvironment } from "@/lib/config";

/** POST: Exchange an OAuth code for an access token */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: "No authorization code provided" },
        { status: 400 }
      );
    }

    console.log("Exchanging OAuth code:", code.substring(0, 10) + "...");
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);
    console.log("Got access token:", accessToken.substring(0, 20) + "...");
    console.log("Expires in:", expiresIn, "seconds");

    const env = getEnvironment();
    setAuthFromToken(accessToken, env);

    return NextResponse.json({
      success: true,
      environment: env,
      connected: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth exchange failed";
    console.error("OAuth exchange error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
