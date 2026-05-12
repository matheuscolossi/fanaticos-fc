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

module.exports = {
  buildAdminMiddleware,
  buildAuthMiddleware,
};
