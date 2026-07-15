const { sendCreated } = require('../utils/http');
const {
  getProfile,
  loginUser,
  registerUser,
  reenviarCodigoEmail,
  updateProfile,
  verificarCodigoEmail,
} = require('../services/authService');

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  return {
    httpOnly: true,
    secure: isProduction,
    // O frontend usa o proxy same-origin /api do Vercel. Lax evita cookies de
    // terceiros e reduz CSRF sem impedir a navegação normal da loja.
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}

function setSessionCookie(res, result) {
  if (!result?.token) return result;
  res.cookie('fc_session', result.token, sessionCookieOptions());
  const { token, ...publicResult } = result;
  return publicResult;
}

function buildAuthController(jwtSecret) {
  return {
    async register(req, res) {
      sendCreated(res, setSessionCookie(res, await registerUser(req.body, jwtSecret)));
    },

    async login(req, res) {
      res.json(setSessionCookie(res, await loginUser(req.body, jwtSecret)));
    },

    async verificarEmail(req, res) {
      res.json(setSessionCookie(res, await verificarCodigoEmail(req.body, jwtSecret)));
    },

    async reenviarCodigo(req, res) {
      res.json(await reenviarCodigoEmail(req.body));
    },

    async profile(req, res) {
      res.json(await getProfile(req.user.id));
    },

    async updateProfile(req, res) {
      const user = await updateProfile(req.user.id, req.body);
      res.json({ message: 'Profile updated.', user });
    },

    logout(req, res) {
      const options = sessionCookieOptions();
      delete options.maxAge;
      res.clearCookie('fc_session', options);
      res.status(204).end();
    },
  };
}

module.exports = { buildAuthController };
