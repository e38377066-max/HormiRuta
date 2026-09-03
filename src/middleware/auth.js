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
    const user = await User.findByPk(userId);
    if (!user || user.active === false) {
      return res.status(401).json({ error: 'Cuenta inactiva o no encontrada' });
    }
    if (req.session) req.session.userId = userId;
    req.userId = userId;
    req.user = user;
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
      if (user.active === false) {
        return res.status(401).json({ error: 'Cuenta inactiva' });
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

/**
 * Middleware para las operaciones que un recepcionista necesita realizar
 * dentro de despacho y recepción de paquetes.
 */
export const requireAdminOrReceptionist = requireRole('admin', 'receptionist');

export const requireNotReceptionist = (req, res, next) => {
  if (req.user?.role === 'receptionist') {
    return res.status(403).json({ error: 'El rol recepcionista no tiene acceso a esta área' });
  }
  return next();
};

/**
 * Restringe las APIs disponibles para el rol recepcionista. Se monta después
 * de /api/auth para no bloquear login, logout ni /me, y antes del resto de
 * routers para que la restricción también aplique a llamadas directas.
 */
const receptionistApiAccess = [
  ['GET', /^\/dispatch\/orders$/],
  ['GET', /^\/dispatch\/routes$/],
  ['GET', /^\/dispatch\/drivers$/],
  ['GET', /^\/dispatch\/favorites$/],
  ['POST', /^\/dispatch\/routes$/],
  ['GET', /^\/dispatch\/routes\/[^/]+\/detail$/],
  ['POST', /^\/dispatch\/routes\/[^/]+\/orders$/],
  ['DELETE', /^\/dispatch\/routes\/[^/]+\/stops\/[^/]+$/],
  ['POST', /^\/dispatch\/routes\/[^/]+\/optimize$/],
  ['PUT', /^\/dispatch\/routes\/[^/]+\/assign$/],
  ['GET', /^\/dispatch\/pickup\/pending$/],
  ['GET', /^\/dispatch\/pickup\/history$/],
  ['POST', /^\/dispatch\/pickup\/[^/]+\/confirm-stops$/],
  ['GET', /^\/dispatch\/returns$/],
  ['PUT', /^\/dispatch\/returns\/[^/]+\/receive$/],
  ['PUT', /^\/dispatch\/returns\/[^/]+\/release$/]
];

const isAllowedReceptionistApi = (req) =>
  receptionistApiAccess.some(([method, path]) => method === req.method && path.test(req.path));

export const restrictReceptionistApiAccess = (req, res, next) => {
  // Estos endpoints son públicos o son webhooks de Respond.io.
  if (req.path.startsWith('/messaging/public/') || req.path === '/messaging/webhook') {
    return next();
  }

  return requireAuth(req, res, () => {
    if (req.user?.role !== 'receptionist' || isAllowedReceptionistApi(req)) {
      return next();
    }
    return res.status(403).json({ error: 'El rol recepcionista solo puede acceder a despacho y recepción de paquetes' });
  });
};
