function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);

  const status = err.status ?? 500;
  const message = err.message ?? 'Erro interno do servidor';

  res.status(status).json({ message });
}

module.exports = { errorHandler };
