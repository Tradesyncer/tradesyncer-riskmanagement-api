import dotenv from "dotenv";
import path from "path";

// In Next.js, .env is auto-loaded. For CLI usage, load it manually.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export type Environment = "live" | "demo";

export function getEnvironment(): Environment {
  const env = (process.env.TRADOVATE_ENV ?? "demo").toLowerCase();
  if (env !== "live" && env !== "demo") {
    throw new Error(`TRADOVATE_ENV must be "live" or "demo", got "${env}"`);
  }
  return env;
}

export function getBaseUrl(env: Environment): string {
  return env === "live"
    ? "https://live.tradovateapi.com/v1"
    : "https://demo.tradovateapi.com/v1";
}
