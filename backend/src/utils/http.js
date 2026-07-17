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
  const payloadTooLarge = err.type === 'entity.too.large';
  const invalidJson = err.type === 'entity.parse.failed';
  const statusCode = payloadTooLarge ? 413 : (invalidJson ? 400 : (err.statusCode || err.status || 500));
  const code = payloadTooLarge
    ? 'PAYLOAD_TOO_LARGE'
    : (invalidJson ? 'INVALID_JSON' : (err.code || 'INTERNAL_SERVER_ERROR'));
  const message = payloadTooLarge
    ? 'O corpo da requisição excede o limite permitido para esta rota.'
    : (invalidJson
      ? 'O corpo JSON da requisição é inválido.'
      : (statusCode >= 500 && !err.expose ? 'Unexpected server error.' : err.message));

  if (statusCode >= 500) {
    console.error('[api:error]', {
      method: req.method,
      path: req.originalUrl,
      code,
      message: err.message,
    });
  }

  res.status(statusCode).json({
    error: message,
    code,
    ...(statusCode < 500 && err.details !== undefined ? { details: err.details } : {}),
  });
}

module.exports = {
  asyncHandler,
  createHttpError,
  errorHandler,
  sendCreated,
};
