/**
 * @fileoverview Middleware y utilidades de autenticación.
 * Gestiona la generación de tokens, validación de sesiones y protección de rutas basada en roles.
 */

import crypto from 'crypto';
import User from '../models/User.js';
import UserToken from '../models/UserToken.js';

/**
 * @description Genera un token aleatorio para un usuario y lo almacena en la base de datos.
 * @param {number} userId - El ID del usuario.
 * @returns {Promise<string>} El token generado en formato hexadecimal.
 */
export async function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await UserToken.create({
    token,
    user_id: userId,
    created_at_ms: Date.now()
  });
  return token;
}

/**
 * @description Obtiene el ID de usuario asociado a un token, verificando que no haya expirado.
 * @param {string} token - El token de autenticación.
 * @returns {Promise<number|null>} El ID del usuario o null si el token es inválido o expiró.
 */
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

/**
 * @description Elimina un token de la base de datos (logout).
 * @param {string} token - El token a eliminar.
 * @returns {Promise<void>}
 */
export async function removeToken(token) {
  if (!token) return;
  try {
    await UserToken.destroy({ where: { token } });
  } catch {}
}

/**
 * @description Resuelve el ID de usuario desde la sesión o el encabezado Authorization (Bearer token).
 * @param {Object} req - Objeto de solicitud de Express.
 * @returns {Promise<number|null>} El ID del usuario resuelto.
 * @private
 */
async function resolveUserId(req) {
  if (req.session?.userId) return req.session.userId;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return await getUserIdFromToken(token);
  }
  return null;
}

/**
 * @description Middleware que requiere que el usuario esté autenticado.
 * @param {Object} req - Objeto de solicitud de Express.
 * @param {Object} res - Objeto de respuesta de Express.
 * @param {Function} next - Función para pasar al siguiente middleware.
 */
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

/**
 * @description Middleware que requiere que el usuario tenga uno de los roles especificados.
 * @param {...string} roles - Lista de roles permitidos.
 * @returns {Function} Middleware de Express.
 */
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

/**
 * @description Middleware especializado que requiere el rol de 'admin'.
 */
export const requireAdmin = requireRole('admin');
