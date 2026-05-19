const { sendCreated } = require('../utils/http');
const { getProfile, loginUser, registerUser, updateProfile } = require('../services/authService');

function buildAuthController(jwtSecret) {
  return {
    async register(req, res) {
      sendCreated(res, await registerUser(req.body));
    },

    async login(req, res) {
      res.json(await loginUser(req.body, jwtSecret));
    },

    async profile(req, res) {
      res.json(await getProfile(req.user.id));
    },

    async updateProfile(req, res) {
      const user = await updateProfile(req.user.id, req.body);
      res.json({ message: 'Profile updated.', user });
    },
  };
}

module.exports = { buildAuthController };
