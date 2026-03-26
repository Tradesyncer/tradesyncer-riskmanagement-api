import dotenv from "dotenv";
import path from "path";
import Server from './server';

const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.prod" : ".env.dev";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`Loaded env: ${envFile} (NODE_ENV=${nodeEnv})`);

(async () => {
  await Server.start();
})();

function logFatal(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  try {
    const { logger } = require("./lib/grafana");
    logger.error(`${label}: ${message}`);
  } catch { /* logger not ready */ }
  console.error(label, err);
}

process.on('unhandledRejection', async (reason) => {
  logFatal("Unhandled rejection", reason);
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  logFatal("Uncaught exception", error);
  process.exit(1);
});
