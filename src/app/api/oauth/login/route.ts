import { NextResponse } from "next/server";
import { getOAuthLoginUrl } from "@/lib/oauth";

export async function GET() {
  try {
    const url = getOAuthLoginUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
