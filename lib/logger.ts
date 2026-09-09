import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    isProduction || isTest
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
  base: {
    service: "ai-multi-news",
    env: process.env.NODE_ENV ?? "development",
  },
});

export function logJobEvent(
  jobId: string,
  event: string,
  meta?: Record<string, unknown>
) {
  logger.info({ jobId, ...meta }, event);
}

export function logJobError(
  jobId: string,
  error: unknown,
  meta?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ jobId, error: message, ...meta }, "job_error");
}
