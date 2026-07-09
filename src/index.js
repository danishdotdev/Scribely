require('dotenv').config();

const express = require('express');
const logger = require('./utils/logger');
const routes = require('./routes/app.routes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.get('origin');
  const isLocalOrigin = !origin
    || origin === 'null'
    || origin === 'file://'
    || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  if (isLocalOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,x-api-key,x-chunk-sequence');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '50mb'
}));

app.use(routes);

const server = app.listen(port, () => {
  logger.info(`Scribely API listening on port ${port}`);
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
