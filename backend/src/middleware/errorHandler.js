const { env } = require('../config/env');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);

  const status = err.status ?? 500;
  const isServerError = status >= 500;
  const message =
    isServerError && env.isProduction
      ? 'Erro interno do servidor'
      : (err.message ?? 'Erro interno do servidor');

  res.status(status).json({ message });
}

module.exports = { errorHandler };
