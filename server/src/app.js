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

  app.use(helmet());
  app.use(cors({ origin: buildOriginChecker(allowedOrigins) }));
  app.use(express.json());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use('/api', routes);

  app.use((req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
