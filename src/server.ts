import Hapi, { server } from "@hapi/hapi";
import { logger, startMetricsPush } from "./lib/grafana";
import Router from "./router";
import Plugins from "./plugins";


export default class Server {
  private static _instance: Hapi.Server;

  public static async start(): Promise<Hapi.Server> {
    try {
      const host = process.env.HOST || '0.0.0.0';
      const port = process.env.PORT || 4000;
      /*
      ** Initiating Hapi server
      */
      Server._instance = new Hapi.Server({
        host,
        port,
        routes: {
          auth: 'firebase',
          cors: true,
          state: {
            parse: true
          }
        },
        state: {
          strictHeader: false
        },
      });

      Server._instance.validator(require('joi'));

      await Plugins.registerAll(Server._instance);

      Server._instance.auth.default('firebase');

      await Router.loadRoutes(Server._instance);

      await Server._instance.start();

      logger.info(`Server up and running at http://${host}:${port}`);

      logger.info(`Risk Management Microservice running on ${Server._instance.info.uri}`);
      logger.info(`Docs: ${Server._instance.info.uri}/risk-management/docs`);
      logger.info(`Swagger: ${Server._instance.info.uri}/risk-management/swagger`);
      logger.info(`OpenAPI: ${Server._instance.info.uri}/risk-management/swagger.json`);
      logger.info(`Metrics: ${Server._instance.info.uri}/metrics`);

      startMetricsPush();

      return Server._instance;
    } catch (error) {
      logger.error(`Server startup error: ${(error as Error).message}`);
      throw error;
    }
  }

  public static stop(): Promise<Error | void> {
    return Server._instance.stop();
  }

  public static async recycle(): Promise<Hapi.Server> {
    await Server.stop();

    return await Server.start();
  }

  public static instance(): Hapi.Server {
    return Server._instance;
  }

  public static async inject(
    options: string | Hapi.ServerInjectOptions
  ): Promise<Hapi.ServerInjectResponse> {
    return await Server._instance.inject(options);
  }
}
