const express = require('express');
const { asyncHandler, sendCreated } = require('../utils/http');
const { getProfile, loginUser, registerUser, updateProfile } = require('../services/authService');

module.exports = ({ authMiddleware, jwtSecret }) => {
  const router = express.Router();

  router.post('/register', asyncHandler(async (req, res) => {
    sendCreated(res, await registerUser(req.body));
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    res.json(await loginUser(req.body, jwtSecret));
  }));

  router.get('/perfil', authMiddleware, asyncHandler(async (req, res) => {
    res.json(await getProfile(req.user.id));
  }));

  router.put('/perfil', authMiddleware, asyncHandler(async (req, res) => {
    const user = await updateProfile(req.user.id, req.body);
    res.json({ message: 'Profile updated.', user });
  }));

  return router;
};
