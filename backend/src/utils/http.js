function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function sendCreated(res, payload) {
  return res.status(201).json(payload);
}

function createHttpError(statusCode, message, code = 'REQUEST_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = statusCode >= 500 ? 'Unexpected server error.' : err.message;

  if (statusCode >= 500) {
    console.error('[api:error]', {
      method: req.method,
      path: req.originalUrl,
      code,
      message: err.message,
    });
  }

  res.status(statusCode).json({ error: message, code });
}

module.exports = {
  asyncHandler,
  createHttpError,
  errorHandler,
  sendCreated,
};
