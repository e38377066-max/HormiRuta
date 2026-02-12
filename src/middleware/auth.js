import crypto from 'crypto';
import User from '../models/User.js';

const tokenStore = new Map();

export function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  tokenStore.set(token, { userId, createdAt: Date.now() });
  return token;
}

export function getUserIdFromToken(token) {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - entry.createdAt > MAX_AGE) {
    tokenStore.delete(token);
    return null;
  }
  return entry.userId;
}

export function removeToken(token) {
  tokenStore.delete(token);
}

function resolveUserId(req) {
  if (req.session?.userId) return req.session.userId;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return getUserIdFromToken(token);
  }
  return null;
}

export const requireAuth = (req, res, next) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  req.session.userId = userId;
  next();
};

export const requireRole = (...roles) => {
  return async (req, res, next) => {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    req.session.userId = userId;

    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: 'No tienes permisos para esta accion' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Error verificando rol:', error);
      res.status(500).json({ error: 'Error interno' });
    }
  };
};

export const requireAdmin = requireRole('admin');
