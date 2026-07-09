const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'meeting-bot' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'headers.authorization',
      '*.apiKey',
      '*.api_key',
      '*.token',
      '*.access_token',
      '*.refresh_token',
      '*.password',
      '*.secret',
      '*.signature'
    ],
    censor: '[REDACTED]'
  }
});

logger.security = function security(event, details = {}) {
  logger.warn({ category: 'security', event, ...details }, `[SECURITY] ${event}`);
};

module.exports = logger;

