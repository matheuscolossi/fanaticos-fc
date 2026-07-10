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

function parsePermissoes(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

// Carrega o usuário atual do banco (não confia apenas no JWT) para que uma
// desativação de acesso tenha efeito imediato, sem esperar o token expirar.
async function loadActiveAdmin(req) {
  const userModel = require('../models/userModel');
  if (req.user?.perfil !== 'admin') {
    throw createHttpError(403, 'Administrator access is required.', 'ADMIN_ACCESS_REQUIRED');
  }
  const user = await userModel.findById(req.user.id);
  if (!user || user.perfil !== 'admin') {
    throw createHttpError(403, 'Administrator access is required.', 'ADMIN_ACCESS_REQUIRED');
  }
  if (user.status === 'inativo') {
    throw createHttpError(403, 'Seu acesso foi desativado.', 'ACCESS_DISABLED');
  }
  return user;
}

function buildAdminMiddleware(authMiddleware) {
  return function adminMiddleware(req, res, next) {
    authMiddleware(req, res, async (err) => {
      if (err) return next(err);
      try {
        req.staffUser = await loadActiveAdmin(req);
        next();
      } catch (e) {
        next(e);
      }
    });
  };
}

// Igual ao adminMiddleware, mas também exige uma permissão específica
// (ex.: "produtos.excluir") dentre as concedidas individualmente ao funcionário.
function buildPermissionMiddleware(authMiddleware, permissionKey) {
  return function permissionMiddleware(req, res, next) {
    authMiddleware(req, res, async (err) => {
      if (err) return next(err);
      try {
        const user = await loadActiveAdmin(req);
        const permissoes = parsePermissoes(user.permissoes);
        if (!permissoes.includes(permissionKey)) {
          return next(createHttpError(403, 'Você não tem permissão para esta ação.', 'PERMISSION_DENIED'));
        }
        req.staffUser = user;
        next();
      } catch (e) {
        next(e);
      }
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
  buildPermissionMiddleware,
};
