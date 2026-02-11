import dotenv from "dotenv";
import path from "path";
import Hapi from "@hapi/hapi";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import HapiSwagger from "hapi-swagger";
import HapiRateLimit from "hapi-rate-limit";
import { initFirebase } from "./firebase";
import { authPlugin } from "./middleware";
import { registerRoutes } from "./routes";

// Load environment-specific .env file
const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.prod" : ".env.dev";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`Loaded env: ${envFile} (NODE_ENV=${nodeEnv})`);

const init = async () => {
  initFirebase();

  const server = Hapi.server({
    port: parseInt(process.env.PORT ?? "4000", 10),
    host: "0.0.0.0",
    routes: {
      cors: true,
    },
  });

  // Register Swagger
  await server.register([
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: {
        info: {
          title: "Tradovate Risk Management API",
          description:
            "Microservice for setting daily loss limits (DLL) and daily profit targets (DPT) on Tradovate accounts.",
          version: "1.0.0",
        },
        documentationPath: "/risk-management/swagger",
        jsonPath: "/risk-management/swagger.json",
        basePath: "/risk-management",
        pathPrefixSize: 2,
        grouping: "tags",
        sortTags: "alpha",
      },
    },
  ]);

  // Register rate limiting
  await server.register({
    plugin: HapiRateLimit,
    options: {
      userLimit: 60,           // 60 requests per user per window
      userCache: {
        expiresIn: 60 * 1000, // 1 minute window
      },
      pathLimit: 30,           // 30 requests per path per window
      pathCache: {
        expiresIn: 60 * 1000,
      },
      headers: true,           // include X-RateLimit headers in response
      ipWhitelist: [],
      trustProxy: true,
      getIpFromProxyHeader: undefined,
    },
  });

  // Register auth plugin
  await server.register(authPlugin);

  // Scalar UI
  server.route({
    method: "GET",
    path: "/risk-management/docs",
    options: { auth: false, plugins: { "hapi-swagger": { exclude: true } } },
    handler: (_request, h) => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Risk Management API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/risk-management/swagger.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
      return h.response(html).type("text/html");
    },
  });

  // Register routes
  registerRoutes(server);

  await server.start();

  console.log(`Risk Management Microservice running on ${server.info.uri}`);
  console.log(`\nDocs:`);
  console.log(`  Scalar:  ${server.info.uri}/risk-management/docs`);
  console.log(`  Swagger: ${server.info.uri}/risk-management/swagger`);
  console.log(`  JSON:    ${server.info.uri}/risk-management/swagger.json`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /risk-management/health                  - Health check`);
  console.log(`  GET  /risk-management/accounts                - List accounts`);
  console.log(`  GET  /risk-management/risk/{accountId}        - Get risk settings`);
  console.log(`  PUT  /risk-management/risk/{accountId}        - Set risk settings`);
};

process.on("unhandledRejection", (err) => {
  console.error(err);
  process.exit(1);
});

init();
