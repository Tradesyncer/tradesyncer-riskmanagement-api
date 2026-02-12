import winston from "winston";
import LokiTransport from "winston-loki";
import client from "prom-client";
import type { Plugin, Request, ResponseToolkit, Server } from "@hapi/hapi";

const isProduction = process.env.NODE_ENV === "production";
const environment = isProduction ? "production" : "testing";

const GRAFANA_LOKI_URL = process.env.GRAFANA_LOKI_URL || "";
const GRAFANA_LOKI_USER = process.env.GRAFANA_LOKI_USER || "";
const GRAFANA_LOKI_TOKEN = process.env.GRAFANA_LOKI_TOKEN || "";
const GRAFANA_OTLP_URL = process.env.GRAFANA_OTLP_URL || "";
const GRAFANA_OTLP_USER = process.env.GRAFANA_OTLP_USER || process.env.GRAFANA_METRICS_USER || "";

const isGrafanaConfigured = GRAFANA_LOKI_URL && GRAFANA_LOKI_USER && GRAFANA_LOKI_TOKEN;

const hostname = isProduction ? "tradesyncer-prod-rm-api" : "tradesyncer-rm-api-testing";
const instance = isProduction
  ? "tradesyncer-prod-rm-api.azurewebsites.net:443"
  : "tradesyncer-rm-api-testing.azurewebsites.net:443";

const commonLabels = {
  hostname,
  env: environment,
  service: "risk-management-api",
  source: "risk-management-api",
  instance,
};

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    ),
  }),
];

if (isGrafanaConfigured) {
  transports.push(
    new LokiTransport({
      host: GRAFANA_LOKI_URL,
      labels: commonLabels,
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => console.error("Loki connection error:", err),
      basicAuth: `${GRAFANA_LOKI_USER}:${GRAFANA_LOKI_TOKEN}`,
    })
  );
  console.log(`Grafana Loki enabled: ${GRAFANA_LOKI_URL} (env=${environment})`);
} else {
  console.log("Grafana Loki not configured - logs only to console");
}

export const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  defaultMeta: { service: "risk-management-api" },
  transports,
});

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: "risk_management_api_",
  labels: commonLabels,
});

export const httpRequestDuration = new client.Histogram({
  name: "risk_management_api_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code", "env"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: "risk_management_api_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code", "env"],
  registers: [register],
});

export const activeConnections = new client.Gauge({
  name: "risk_management_api_active_connections",
  help: "Number of active connections",
  labelNames: ["env"],
  registers: [register],
});

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export function getMetricsContentType(): string {
  return register.contentType;
}

let metricsInterval: NodeJS.Timeout | null = null;

async function pushMetricsToGrafana(): Promise<void> {
  if (!GRAFANA_OTLP_URL || !GRAFANA_OTLP_USER || !GRAFANA_LOKI_TOKEN) return;

  try {
    const metrics = await register.getMetricsAsJSON();
    const now = Date.now();
    const nowNanos = BigInt(now) * BigInt(1000000);

    const resourceMetrics = {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "risk-management-api" } },
            { key: "service", value: { stringValue: "risk-management-api" } },
            { key: "deployment.environment", value: { stringValue: environment } },
            { key: "env", value: { stringValue: environment } },
            { key: "host.name", value: { stringValue: hostname } },
            { key: "hostname", value: { stringValue: hostname } },
            { key: "instance", value: { stringValue: instance } },
          ],
        },
        scopeMetrics: [{
          scope: { name: "risk-management-api", version: "1.0.0" },
          metrics: [] as any[],
        }],
      }],
    };

    const scopeMetrics = resourceMetrics.resourceMetrics[0].scopeMetrics[0].metrics;

    for (const metric of metrics as any[]) {
      if (!metric.values || !Array.isArray(metric.values)) continue;

      const name = metric.name;
      const description = metric.help || "";

      for (const value of metric.values) {
        const attributes = Object.entries(value.labels || {}).map(([k, v]) => ({
          key: k,
          value: { stringValue: String(v) },
        }));
        const val = typeof value.value === "number" && !isNaN(value.value) ? value.value : 0;

        if (metric.type === "counter" || name.endsWith("_total")) {
          scopeMetrics.push({
            name,
            description,
            sum: {
              dataPoints: [{
                attributes,
                startTimeUnixNano: nowNanos.toString(),
                timeUnixNano: nowNanos.toString(),
                asDouble: val,
              }],
              aggregationTemporality: 2,
              isMonotonic: true,
            },
          });
          continue;
        }

        if (metric.type === "histogram") continue;

        scopeMetrics.push({
          name,
          description,
          gauge: {
            dataPoints: [{
              attributes,
              timeUnixNano: nowNanos.toString(),
              asDouble: val,
            }],
          },
        });
      }
    }

    if (scopeMetrics.length === 0) return;

    const pushUrl = `${GRAFANA_OTLP_URL.replace(/\/$/, "")}/v1/metrics`;
    const response = await fetch(pushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${GRAFANA_OTLP_USER}:${GRAFANA_LOKI_TOKEN}`).toString("base64")}`,
      },
      body: JSON.stringify(resourceMetrics),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn(`Failed to push metrics to Grafana: ${response.status} - ${text}`);
    }
  } catch (error) {
    logger.error("Error pushing metrics to Grafana:", error);
  }
}

export function startMetricsPush(intervalMs = 15000): void {
  if (GRAFANA_OTLP_URL && GRAFANA_OTLP_USER) {
    console.log(`Grafana OTLP Metrics Push enabled: every ${intervalMs / 1000}s to ${GRAFANA_OTLP_URL}`);
    metricsInterval = setInterval(pushMetricsToGrafana, intervalMs);
    void pushMetricsToGrafana();
    return;
  }

  console.log("Grafana OTLP metrics not configured - metrics only via /metrics endpoint");
}

export function stopMetricsPush(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

export const grafanaPlugin: Plugin<{}> = {
  name: "grafana-metrics",
  version: "1.0.0",
  register: async (server: Server) => {
    server.ext("onRequest", (_request: Request, h: ResponseToolkit) => {
      activeConnections.inc({ env: environment });
      return h.continue;
    });

    server.events.on("response", (request: Request) => {
      activeConnections.dec({ env: environment });

      const response = request.response;
      const statusCode = "statusCode" in response ? response.statusCode : 500;
      const route = request.route.path || "unknown";
      const method = request.method.toUpperCase();

      httpRequestTotal.inc({
        method,
        route,
        status_code: statusCode.toString(),
        env: environment,
      });

      const duration = (Date.now() - request.info.received) / 1000;
      httpRequestDuration.observe(
        { method, route, status_code: statusCode.toString(), env: environment },
        duration
      );

      const logLevel = statusCode >= 400 ? "warn" : "debug";
      logger.log(logLevel, `${method} ${request.path}`, {
        statusCode,
        duration: `${duration.toFixed(3)}s`,
        userAgent: request.headers["user-agent"],
      });
    });

    server.route({
      method: "GET",
      path: "/metrics",
      options: {
        auth: false,
        tags: ["metrics"],
        description: "Prometheus metrics endpoint",
        plugins: {
          "hapi-swagger": {
            exclude: true,
          },
        },
      },
      handler: async (_request, h) => {
        const metrics = await getMetrics();
        return h.response(metrics).type(getMetricsContentType());
      },
    });

    logger.info("Grafana metrics plugin registered");
  },
};
