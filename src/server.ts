import dotenv from "dotenv";
import path from "path";
import Hapi from "@hapi/hapi";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import HapiSwagger from "hapi-swagger";
import HapiRateLimit from "hapi-rate-limit";
import { initFirebase } from "./lib/firebase";
import { authPlugin } from "./lib/middleware";
import { grafanaPlugin, logger, startMetricsPush } from "./lib/grafana";
import Router from "./router";

const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.prod" : ".env.dev";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`Loaded env: ${envFile} (NODE_ENV=${nodeEnv})`);

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/prop-9f30a.appspot.com/o/images%2FLogo%20(1).png?alt=media&token=8757078d-3711-4f78-9af4-4b8d717aadea";
const FAVICON_SVG = "data:image/svg+xml,%3Csvg width='320' height='320' viewBox='0 0 320 320' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='320' height='320' fill='url(%23paint0_linear_19_1474)'/%3E%3Cpath d='M65 160.017V112.227H113.985V142.033C113.985 151.954 122.042 160 131.976 160H159.996V253H114.053V177.984C114.053 168.063 105.997 160.017 96.0619 160.017H65Z' fill='white'/%3E%3Cpath d='M255 159.992V207.782H206.015V177.975C206.015 168.054 197.958 160.009 188.024 160.009H160.004V67H205.956V142.016C205.956 151.937 214.012 159.983 223.947 159.983H255V159.992Z' fill='white'/%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear_19_1474' x1='34.5212' y1='3.07011e-06' x2='160' y2='320' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23BEA9FE'/%3E%3Cstop offset='1' stop-color='%23253CFF'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E";

export const createServer = async (): Promise<Hapi.Server> => {
  initFirebase();

  const server = Hapi.server({
    port: parseInt(process.env.PORT ?? "4000", 10),
    host: "0.0.0.0",
    routes: {
      cors: true,
    },
  });

  await server.register([
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: {
        info: {
          title: "Tradesyncer Risk Management API",
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

  await server.register({
    plugin: HapiRateLimit,
    options: {
      userLimit: 60,
      userCache: {
        expiresIn: 60 * 1000,
      },
      pathLimit: 30,
      pathCache: {
        expiresIn: 60 * 1000,
      },
      headers: true,
      ipWhitelist: [],
      trustProxy: true,
      getIpFromProxyHeader: undefined,
    },
  });

  await server.register(authPlugin);
  await server.register(grafanaPlugin as any);

  server.route({
    method: "GET",
    path: "/risk-management/docs",
    options: { auth: false, plugins: { "hapi-swagger": { exclude: true } } },
    handler: (_request, h) => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Tradesyncer Risk Management API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="${FAVICON_SVG}" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    :root {
      --scalar-custom-header-height: 56px;
    }
    .custom-header {
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--scalar-custom-header-height);
      background-color: var(--scalar-background-1);
      box-shadow: inset 0 -1px 0 var(--scalar-border-color);
      color: var(--scalar-color-1);
      font-size: var(--scalar-font-size-2);
      padding: 0 18px;
      justify-content: space-between;
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .scalar-app .sidebar {
      top: var(--scalar-custom-header-height) !important;
      height: calc(100vh - var(--scalar-custom-header-height)) !important;
    }
    .custom-header .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: inherit;
    }
    .custom-header .logo img {
      height: 32px;
      width: auto;
      border-radius: 6px;
    }
    .custom-header .logo span {
      font-weight: 600;
      font-size: 18px;
    }
    .custom-header nav {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .custom-header nav a {
      color: var(--scalar-color-2);
      text-decoration: none;
      font-size: 14px;
    }
    .custom-header nav a:hover {
      color: var(--scalar-color-1);
    }
  </style>
</head>
<body>
  <header class="custom-header scalar-app">
    <a href="https://tradesyncer.com" class="logo" target="_blank">
      <img src="${LOGO_URL}" alt="Tradesyncer" />
      <span>Tradesyncer Risk Management API</span>
    </a>
    <nav>
      <a href="https://tradesyncer.com" target="_blank">Website</a>
      <a href="https://github.com/tradesyncer" target="_blank">GitHub</a>
    </nav>
  </header>
  <script id="api-reference" data-url="/risk-management/swagger.json"></script>
  <script>
    document.getElementById('api-reference').dataset.configuration = JSON.stringify({
      theme: 'purple',
      darkMode: true,
      layout: 'modern',
      hideModels: true,
      hideDownloadButton: true,
      hideClientButton: true,
      hiddenClients: true,
      metaData: {
        title: 'Tradesyncer Risk Management API',
      },
    });
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
      return h.response(html).type("text/html");
    },
  });

  await Router.loadRoutes(server);

  return server;
};

export const start = async (): Promise<Hapi.Server> => {
  const server = await createServer();
  await server.start();

  logger.info(`Risk Management Microservice running on ${server.info.uri}`);
  logger.info(`Docs: ${server.info.uri}/risk-management/docs`);
  logger.info(`Swagger: ${server.info.uri}/risk-management/swagger`);
  logger.info(`OpenAPI: ${server.info.uri}/risk-management/swagger.json`);
  logger.info(`Metrics: ${server.info.uri}/metrics`);

  startMetricsPush();

  return server;
};

process.on("unhandledRejection", (err) => {
  console.error(err);
  process.exit(1);
});

start();
