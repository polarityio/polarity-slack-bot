import pino from 'pino';

/**
 * Centralised application logger.
 * Pretty-prints locally, outputs structured JSON in production.
 */
export const logger = pino({
  level: process.env.POLARITY_LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { colorize: true } }
});
