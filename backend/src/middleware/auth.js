const jwt = require('jsonwebtoken');
const { createHttpError } = require('../utils/http');
const userModel = require('../models/userModel');

function parsePermissoes(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function buildCurrentUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    cargo: user.cargo || null,
    permissoes: parsePermissoes(user.permissoes),
    status: user.status || 'ativo',
    email_verificado: Boolean(user.email_verificado),
  };
}

function buildAuthMiddleware(jwtSecret) {
  return function authMiddleware(req, res, next) {
    const authorization = req.headers.authorization || '';
    const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const cookieToken = String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('fc_session='))
      ?.slice('fc_session='.length);
    let token = bearerToken;
    if (cookieToken) {
      try { token = decodeURIComponent(cookieToken); }
      catch { return next(createHttpError(401, 'Invalid authentication token.', 'AUTH_TOKEN_INVALID')); }
    }
    if (!token) return next(createHttpError(401, 'Authentication token is required.', 'AUTH_TOKEN_REQUIRED'));

    let tokenUser;
    try {
      tokenUser = jwt.verify(token, jwtSecret);
    } catch {
      return next(createHttpError(401, 'Invalid or expired authentication token.', 'AUTH_TOKEN_INVALID'));
    }

    // O JWT apenas identifica a sessão. Cargo, permissões e status sempre vêm
    // do banco para que alterações administrativas tenham efeito imediato.
    userModel.findById(tokenUser.id)
      .then((user) => {
        if (!user) {
          return next(createHttpError(401, 'User not found.', 'AUTH_USER_NOT_FOUND'));
        }
        if (user.status === 'inativo') {
          return next(createHttpError(403, 'Seu acesso foi desativado.', 'ACCESS_DISABLED'));
        }

        req.user = buildCurrentUser(user);
        req.staffUser = req.user;
        next();
      })
      .catch(next);
  };
}

function buildAdminMiddleware(authMiddleware) {
  return function adminMiddleware(req, res, next) {
    authMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (!req.user || req.user.perfil !== 'admin') {
        return next(createHttpError(403, 'Administrator access is required.', 'ADMIN_ACCESS_REQUIRED'));
      }
      next();
    });
  };
}

function buildVerifiedEmailMiddleware(authMiddleware) {
  return function verifiedEmailMiddleware(req, res, next) {
    authMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (!req.user?.email_verificado) {
        return next(createHttpError(403, 'Confirme seu e-mail antes de continuar.', 'EMAIL_NOT_VERIFIED'));
      }
      next();
    });
  };
}

function buildOptionalAuthMiddleware(authMiddleware) {
  return function optionalAuthMiddleware(req, res, next) {
    const hasBearer = String(req.headers?.authorization || '').startsWith('Bearer ');
    const hasCookie = String(req.headers?.cookie || '').split(';').some(
      (part) => part.trim().startsWith('fc_session=')
    );
    if (!hasBearer && !hasCookie) return next();

    authMiddleware(req, res, (err) => {
      if (err) {
        delete req.user;
        delete req.staffUser;
      }
      next();
    });
  };
}

function buildPermissionMiddleware(authMiddleware, permissionKey) {
  return function permissionMiddleware(req, res, next) {
    authMiddleware(req, res, (err) => {
      if (err) return next(err);

      if (!req.user || req.user.perfil !== 'admin') {
        return next(createHttpError(403, 'Administrator access is required.', 'ADMIN_ACCESS_REQUIRED'));
      }

      const permissions = Array.isArray(req.user.permissoes) ? req.user.permissoes : [];
      if (!permissions.includes(permissionKey)) {
        return next(createHttpError(403, 'You do not have permission to access this resource.', 'PERMISSION_DENIED'));
      }

      next();
    });
  };
}

// HTTP Basic Auth - exigido pelo PDF do trabalho para POST /products e DELETE /product/:id
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
  buildOptionalAuthMiddleware,
  buildPermissionMiddleware,
  buildVerifiedEmailMiddleware,
};
