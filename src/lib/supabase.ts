import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Initialize and return the Supabase client (service role).
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    client = createClient(url, key);
    console.log("Supabase client initialized:", url);
  }

  return client;
}

/**
 * Look up a Tradovate access token from the tdv_access_token table.
 *
 * Returns the token and associated metadata.
 */
export async function getConnectionToken(
  userId: string,
  connectionRef: string
): Promise<{
  token: string;
  url: string;
}> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tdv_access_token")
    .select("*")
    .eq("uid", userId)
    .eq("ref", connectionRef)
    .single();

  if (error || !data) {
    throw new Error(
      `No Tradovate token found for user ${userId}, connection ${connectionRef}${error ? `: ${error.message}` : ""}`
    );
  }

  if (!data.token) {
    throw new Error(
      `Token is empty for user ${userId}, connection ${connectionRef}`
    );
  }

  return {
    token: data.token,
    url: data.url ?? "https://demo.tradovateapi.com",
  };
}
