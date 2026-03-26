import { createLogger, format, Logger } from "winston";
import path from "path";
import fs from "fs";
import DailyRotateFile from "winston-daily-rotate-file";

let _fileLogger: Logger | null = null;

export function getFileLogger(): Logger {
  if (_fileLogger) return _fileLogger;

  const baseLogPath = process.env.LOG_FILE_PATH || "/home/site/wwwroot";
  const logDir = path.join(baseLogPath, "logs");

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const fileTransport = new DailyRotateFile({
    dirname: logDir,
    filename: "risk-api-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
  });

  _fileLogger = createLogger({
    level: "info",
    format: format.combine(
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      format.printf(({ timestamp, level, message, uid, ...meta }) => {
        const uidTag = uid ? ` [${uid}]` : "";
        let metaStr = "";
        const cleanMeta = { ...meta };
        delete cleanMeta.service;
        if (Object.keys(cleanMeta).length) {
          try {
            metaStr = " " + JSON.stringify(cleanMeta);
          } catch {
            metaStr = " [meta_unserializable]";
          }
        }
        return `[${timestamp}] [${level.toUpperCase()}]${uidTag} ${message}${metaStr}`;
      })
    ),
    transports: [fileTransport],
  });

  return _fileLogger;
}
