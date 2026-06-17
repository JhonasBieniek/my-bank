function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  next();
}

function requireGuest(req, res, next) {
  if (req.session.userId) {
    return res.status(403).json({ message: 'Já autenticado' });
  }

  next();
}

module.exports = { requireAuth, requireGuest };
