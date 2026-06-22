const jwt = require('jsonwebtoken');
const { createHttpError } = require('../utils/http');

function buildAuthMiddleware(jwtSecret) {
  return function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next(createHttpError(401, 'Authentication token is required.', 'AUTH_TOKEN_REQUIRED'));

    try {
      req.user = jwt.verify(token, jwtSecret);
      next();
    } catch {
      next(createHttpError(401, 'Invalid or expired authentication token.', 'AUTH_TOKEN_INVALID'));
    }
  };
}

function buildAdminMiddleware(authMiddleware) {
  return function adminMiddleware(req, res, next) {
    authMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (req.user.perfil !== 'admin') {
        return next(createHttpError(403, 'Administrator access is required.', 'ADMIN_ACCESS_REQUIRED'));
      }
      next();
    });
  };
}

// HTTP Basic Auth — exigido pelo PDF do trabalho para POST /products e DELETE /product/:id
function buildBasicAuthMiddleware(expectedUser, expectedPass) {
  return function basicAuthMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');

    if (scheme !== 'Basic' || !encoded) {
      res.set('WWW-Authenticate', 'Basic realm="api"');
      return next(createHttpError(401, 'Basic auth credentials are required.', 'AUTH_BASIC_REQUIRED'));
    }

    const [user, pass] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (user !== expectedUser || pass !== expectedPass) {
      res.set('WWW-Authenticate', 'Basic realm="api"');
      return next(createHttpError(401, 'Invalid basic auth credentials.', 'AUTH_BASIC_INVALID'));
    }

    next();
  };
}

module.exports = {
  buildAdminMiddleware,
  buildAuthMiddleware,
  buildBasicAuthMiddleware,
};
