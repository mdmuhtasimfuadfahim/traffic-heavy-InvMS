const { AppError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code },
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: { message: 'That value is already taken.', code: 'UNIQUE_CONSTRAINT' },
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: { message: err.errors?.[0]?.message || 'Validation failed', code: 'VALIDATION_ERROR' },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
  });
}

module.exports = errorHandler;
