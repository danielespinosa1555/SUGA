const passport = require('passport');
const jwt = require('jsonwebtoken');

const authenticate = passport.authenticate('jwt', { session: false });

const requireAdmin = (req, res, next) => {
  authenticate(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Token inválido o expirado' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    }
    next();
  });
};

const requireAuth = (req, res, next) => {
  authenticate(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Autenticación requerida' });
    next();
  });
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, org: user.organization_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

module.exports = { authenticate, requireAdmin, requireAuth, generateToken };
