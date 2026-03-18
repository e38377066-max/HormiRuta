import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, '../../.token-store.json');

const MAX_AGE = 365 * 24 * 60 * 60 * 1000;

const tokenStore = new Map();

const loadTokens = () => {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      const now = Date.now();
      for (const [token, entry] of Object.entries(data)) {
        if (now - entry.createdAt < MAX_AGE) {
          tokenStore.set(token, entry);
        }
      }
    }
  } catch {}
};

const saveTokens = () => {
  try {
    const obj = {};
    const now = Date.now();
    for (const [token, entry] of tokenStore.entries()) {
      if (now - entry.createdAt < MAX_AGE) {
        obj[token] = entry;
      }
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(obj), 'utf8');
  } catch {}
};

loadTokens();

export function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  tokenStore.set(token, { userId, createdAt: Date.now() });
  saveTokens();
  return token;
}

export function getUserIdFromToken(token) {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > MAX_AGE) {
    tokenStore.delete(token);
    saveTokens();
    return null;
  }
  return entry.userId;
}

export function removeToken(token) {
  tokenStore.delete(token);
  saveTokens();
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
  if (req.session) req.session.userId = userId;
  req.userId = userId;
  next();
};

export const requireRole = (...roles) => {
  return async (req, res, next) => {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (req.session) req.session.userId = userId;
    req.userId = userId;

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
