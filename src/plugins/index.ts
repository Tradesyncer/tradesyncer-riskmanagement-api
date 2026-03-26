import Hapi from '@hapi/hapi';
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import HapiSwagger from "hapi-swagger";
import HapiRateLimit from "hapi-rate-limit";
import { getFirebaseAdmin } from '../lib/firebase';
import { grafanaPlugin, logger } from "../lib/grafana";

export default class Plugins {

  private static async firebaseAuth(server: Hapi.Server): Promise<Error | any> {
    try {

      await Plugins.register(server, [
        {
          plugin: require('./firebase'),
        },
      ]);

      //firebase
      server.auth.strategy('firebase', 'firebase', {
        instance: getFirebaseAdmin()
      })

    } catch (error) {
      logger.error(`Firebase Auth plugin registration failed: ${(error as any).message}`);
    }
  }

  public static async registerAll(server: Hapi.Server): Promise<Error | any> {

    await Plugins.firebaseAuth(server);

    await Plugins.register(server, [
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

    await Plugins.register(server, [
      {
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
      },
    ]);

    await Plugins.register(server, grafanaPlugin as any);
  }

  private static async register(
    server: Hapi.Server,
    plugin: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      server.register(plugin);
      resolve();
    });
  }
}
