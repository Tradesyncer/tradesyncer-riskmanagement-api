import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/oauth";
import { setAuthFromToken } from "@/lib/session";
import { getEnvironment } from "@/lib/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    const desc = request.nextUrl.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(desc)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=No+authorization+code+received", request.url)
    );
  }

  try {
    console.log("OAuth callback received code:", code.substring(0, 10) + "...");
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);
    console.log("Got access token:", accessToken.substring(0, 20) + "...");
    console.log("Expires in:", expiresIn, "seconds");

    const env = getEnvironment();
    setAuthFromToken(accessToken, env);

    return NextResponse.redirect(new URL("/?connected=true", request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth exchange failed";
    console.error("OAuth callback error:", message);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
