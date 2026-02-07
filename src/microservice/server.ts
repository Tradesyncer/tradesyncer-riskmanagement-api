import dotenv from "dotenv";
import path from "path";

// Load environment-specific .env file
const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.prod" : ".env.dev";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`Loaded env: ${envFile} (NODE_ENV=${nodeEnv})`);
import express from "express";
import cors from "cors";
import { initFirebase } from "./firebase";
import { firebaseAuth } from "./middleware";
import healthRoutes from "./routes/health";
import accountsRoutes from "./routes/accounts";
import riskRoutes from "./routes/risk";

const app = express();
const PORT = parseInt(process.env.PORT ?? "4000", 10);

// ---------------------------------------------------------------------------
// Initialize Firebase
// ---------------------------------------------------------------------------

initFirebase();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check (no auth required)
app.use("/health", healthRoutes);

// All other routes require Firebase auth + connectionRef
app.use("/accounts", firebaseAuth, accountsRoutes);
app.use("/risk", firebaseAuth, riskRoutes);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Risk Management Microservice running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /accounts                  - List accounts`);
  console.log(`  GET  /risk/:accountId            - Get risk settings`);
  console.log(`  POST /risk/:accountId            - Set risk settings`);
  console.log(`\nHeaders required:`);
  console.log(`  Authorization: Bearer <firebase_id_token>`);
  console.log(`  + connectionRef in body, query, or X-Connection-Ref header`);
});

export default app;
