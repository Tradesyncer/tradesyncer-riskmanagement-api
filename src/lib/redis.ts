/**
 * Redis Client
 * 
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "./grafana";

let redisClient: RedisClientType | null = null;
let isConnecting = false;
let redisDisabledLogged = false;

/**
 * Get or create Redis client connection
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    if (!redisDisabledLogged) {
      logger.warn("REDIS_URL not set - Redis features disabled, using in-memory cache only");
      redisDisabledLogged = true;
    }
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    await new Promise((resolve) => setTimeout(resolve, 100));
    return redisClient;
  }

  try {
    isConnecting = true;
    
    redisClient = createClient({ url: REDIS_URL });
    
    redisClient.on("error", (err) => {
      logger.error("Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      logger.info("✅ Redis connected");
    });

    redisClient.on("disconnect", () => {
      logger.info("⚠️ Redis disconnected");
    });

    await redisClient.connect();
    isConnecting = false;
    
    return redisClient;
  } catch (error) {
    isConnecting = false;
    logger.error("❌ Failed to connect to Redis:", error);
    return null;
  }
}


