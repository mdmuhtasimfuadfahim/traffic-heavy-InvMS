require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { parseAllowedOrigins, buildOriginChecker } = require('./utils/corsOrigins');

function createApp({ corsOrigin }) {
  const app = express();
  const allowedOrigins = parseAllowedOrigins(corsOrigin);

  // This API is deliberately called cross-origin (the Vercel-hosted frontend
  // calling this Render-hosted backend), so Helmet's default
  // Cross-Origin-Resource-Policy: same-origin has to be relaxed - otherwise
  // Chrome blocks the response even when the Access-Control-Allow-Origin
  // header is correct, which looks identical to a CORS misconfiguration in
  // the browser console.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: buildOriginChecker(allowedOrigins) }));
  app.use(express.json());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/', (req, res) => {
    res.type('html').send(landingPageHtml());
  });

  app.use('/api', routes);

  app.use((req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  app.use(errorHandler);

  return app;
}

function landingPageHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>InvMS API</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #0b0f19;
        color: #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
      }
      .card {
        max-width: 480px;
        padding: 2rem 2.5rem;
        border: 1px solid #1f2937;
        border-radius: 12px;
        background: #111827;
      }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #9ca3af; line-height: 1.6; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8rem;
        color: #34d399;
        margin-bottom: 1rem;
      }
      .dot {
        width: 8px; height: 8px; border-radius: 50%; background: #34d399;
      }
      code {
        background: #1f2937;
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
        font-size: 0.85em;
      }
      a { color: #818cf8; }
      ul { padding-left: 1.1rem; color: #9ca3af; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="status"><span class="dot"></span> API running</div>
      <h1>Real-Time Inventory System - API</h1>
      <p>This is the Express + Socket.io backend for the Sneaker Drop inventory system. There's no UI here on purpose - the React dashboard lives on Vercel.</p>
      <ul>
        <li><code>GET /api/health</code> - health check</li>
        <li><code>GET /api/drops</code> - list merch drops</li>
        <li><code>POST /api/drops</code> - create a merch drop</li>
      </ul>
      <p>See the repository <a href="https://github.com/mdmuhtasimfuadfahim/traffic-heavy-InvMS">README</a> for the full API reference and architecture notes.</p>
    </div>
  </body>
</html>`;
}

module.exports = createApp;
