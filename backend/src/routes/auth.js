const express = require('express');
const bcrypt = require('bcrypt');
const { registerAccount, normalizeEmail } = require('../services/registerAccountService');
const { prisma } = require('../lib/prisma');
const { sanitizeUser } = require('../lib/sanitizeUser');
const { requireAuth, requireGuest } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post(
  '/register',
  registerLimiter,
  requireGuest,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { user } = req.validated;
      const result = await registerAccount(user);

      if (!result.ok) {
        return res.status(result.error.status).json({ message: result.error.message });
      }

      req.session.userId = result.value.id;
      res.status(201).json({ user: sanitizeUser(result.value) });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/login',
  loginLimiter,
  requireGuest,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.validated;
      const user = await prisma.user.findUnique({
        where: { email: normalizeEmail(email) },
      });

      if (!user || !(await bcrypt.compare(password, user.passwordDigest))) {
        return res.status(401).json({ message: 'E-mail ou senha inválidos' });
      }

      req.session.userId = user.id;
      res.json({ user: sanitizeUser(user) });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Não foi possível encerrar a sessão' });
    }

    res.status(204).send();
  });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Não autenticado' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
