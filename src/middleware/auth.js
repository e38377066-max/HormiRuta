import crypto from 'crypto';
import User from '../models/User.js';
import UserToken from '../models/UserToken.js';

export async function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await UserToken.create({
    token,
    user_id: userId,
    created_at_ms: Date.now()
  });
  return token;
}

export async function getUserIdFromToken(token) {
  if (!token) return null;
  try {
    const entry = await UserToken.findOne({ where: { token } });
    if (!entry) return null;
    const age = Date.now() - Number(entry.created_at_ms);
    if (age > UserToken.MAX_AGE_MS) {
      await entry.destroy();
      return null;
    }
    return entry.user_id;
  } catch {
    return null;
  }
}

export async function removeToken(token) {
  if (!token) return;
  try {
    await UserToken.destroy({ where: { token } });
  } catch {}
}

async function resolveUserId(req) {
  if (req.session?.userId) return req.session.userId;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return await getUserIdFromToken(token);
  }
  return null;
}

export const requireAuth = async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (req.session) req.session.userId = userId;
    req.userId = userId;
    next();
  } catch (error) {
    console.error('requireAuth error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

export const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      const userId = await resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      if (req.session) req.session.userId = userId;
      req.userId = userId;

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
