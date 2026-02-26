import express from 'express';
import { Op } from 'sequelize';
import { User, Route, MessagingOrder } from '../models/index.js';
import { requireAdmin } from '../middleware/auth.js';
import logBuffer from '../services/logService.js';

const router = express.Router();

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { active: true } });
    const adminCount = await User.count({ where: { role: 'admin' } });
    const driverCount = await User.count({ where: { role: 'driver' } });
    const clientCount = await User.count({ where: { role: 'client' } });
    const totalRoutes = await Route.count();
    const totalOrders = await MessagingOrder.count();

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminCount,
        drivers: driverCount,
        clients: clientCount
      },
      routes: totalRoutes,
      orders: totalOrders
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadisticas' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { role, search, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { rows: users, count: total } = await User.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: ['id', 'username', 'email', 'phone', 'role', 'active', 'subscription_type', 'created_at']
    });

    res.json({ users, total });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user.toDict());
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const allowedFields = ['username', 'email', 'phone', 'role', 'active', 'subscription_type'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    }

    await user.save();
    res.json(user.toDict());
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.put('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'client', 'driver'].includes(role)) {
      return res.status(400).json({ error: 'Rol invalido' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.role = role;
    await user.save();
    res.json(user.toDict());
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

router.put('/users/:id/toggle-active', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.active = !user.active;
    await user.save();
    res.json(user.toDict());
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.id === req.userId) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    await user.destroy();
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { level, search, limit = 100, offset = 0 } = req.query;
    const result = logBuffer.getLogs({ level, search, limit, offset });
    res.json(result);
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

router.delete('/logs', requireAdmin, async (req, res) => {
  try {
    logBuffer.clear();
    res.json({ message: 'Logs eliminados' });
  } catch (error) {
    console.error('Clear logs error:', error);
    res.status(500).json({ error: 'Error al limpiar logs' });
  }
});

router.get('/logs/stats', requireAdmin, async (req, res) => {
  try {
    const stats = logBuffer.getFileStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadisticas de logs' });
  }
});

router.get('/logs/download/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    if (type !== 'full' && type !== 'important') {
      return res.status(400).json({ error: 'Tipo invalido. Usa "full" o "important"' });
    }

    const content = logBuffer.getFileContent(type);
    if (!content) {
      return res.status(404).json({ error: 'No hay logs disponibles' });
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = type === 'important'
      ? `logs_24h_${dateStr}.txt`
      : `logs_3dias_${dateStr}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: 'Error al descargar logs' });
  }
});

export default router;
