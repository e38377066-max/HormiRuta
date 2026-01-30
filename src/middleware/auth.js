import User from '../models/User.js';

export const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

export const requireRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    try {
      const user = await User.findByPk(req.session.userId);
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
