/**
 * @fileoverview Rutas de administración del sistema.
 * Proporciona endpoints para estadísticas globales, gestión de usuarios,
 * visualización de logs y limpieza del sistema.
 * Todas las rutas requieren privilegios de administrador.
 */

import express from 'express';
import { Op } from 'sequelize';
import { User, Route, Stop, ValidatedAddress, MessagingOrder } from '../models/index.js';
import { requireAdmin } from '../middleware/auth.js';
import logBuffer from '../services/logService.js';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';

const router = express.Router();

/**
 * @description Obtiene estadísticas globales del sistema (usuarios, rutas, órdenes).
 * @route GET /api/admin/stats
 * @access Private (Admin)
 * @returns {Object} 200 - Estadísticas detalladas por rol y entidad.
 */
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

/**
 * @description Lista usuarios con soporte para filtrado y paginación.
 * @route GET /api/admin/users
 * @access Private (Admin)
 * @param {string} [req.query.role] - Filtrar por rol (admin, driver, client).
 * @param {string} [req.query.search] - Buscar por nombre o email.
 * @param {number} [req.query.limit=50] - Cantidad de registros por página.
 * @param {number} [req.query.offset=0] - Desplazamiento para paginación.
 * @returns {Object} 200 - Lista de usuarios y total de registros.
 */
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
      attributes: ['id', 'username', 'email', 'phone', 'role', 'active', 'subscription_type', 'commission_per_stop', 'created_at']
    });

    res.json({ users, total });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

/**
 * @description Obtiene el perfil detallado de un usuario específico.
 * @route GET /api/admin/users/:id
 * @access Private (Admin)
 * @returns {Object} 200 - Datos completos del usuario.
 * @returns {Object} 404 - Usuario no encontrado.
 */
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

/**
 * @description Actualiza los datos de un usuario específico.
 * @route PUT /api/admin/users/:id
 * @access Private (Admin)
 * @param {Object} req.body - Campos permitidos: username, email, phone, role, active, subscription_type, commission_per_stop.
 * @returns {Object} 200 - Usuario actualizado.
 * @returns {Object} 404 - Usuario no encontrado.
 */
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const allowedFields = ['username', 'email', 'phone', 'role', 'active', 'subscription_type', 'commission_per_stop'];
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

/**
 * @description Cambia el rol de un usuario.
 * @route PUT /api/admin/users/:id/role
 * @access Private (Admin)
 * @param {string} req.body.role - Nuevo rol (admin, client, driver).
 * @returns {Object} 200 - Usuario actualizado.
 * @returns {Object} 400 - Rol inválido.
 */
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

/**
 * @description Activa o desactiva la cuenta de un usuario.
 * @route PUT /api/admin/users/:id/toggle-active
 * @access Private (Admin)
 * @returns {Object} 200 - Usuario actualizado con el nuevo estado.
 */
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

/**
 * @description Elimina permanentemente a un usuario.
 * No permite que un administrador se elimine a sí mismo.
 * @route DELETE /api/admin/users/:id
 * @access Private (Admin)
 * @returns {Object} 200 - Mensaje de éxito.
 * @returns {Object} 400 - Intento de auto-eliminación.
 * @returns {Object} 404 - Usuario no encontrado.
 */
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

/**
 * @description Obtiene los logs del sistema filtrados.
 * @route GET /api/admin/logs
 * @access Private (Admin)
 * @param {string} [req.query.level] - Nivel de log (info, warn, error).
 * @param {string} [req.query.search] - Búsqueda de texto en el contenido.
 * @returns {Object} 200 - Lista de logs paginados.
 */
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

/**
 * @description Limpia el buffer de logs en memoria.
 * @route DELETE /api/admin/logs
 * @access Private (Admin)
 * @returns {Object} 200 - Mensaje de éxito.
 */
router.delete('/logs', requireAdmin, async (req, res) => {
  try {
    logBuffer.clear();
    res.json({ message: 'Logs eliminados' });
  } catch (error) {
    console.error('Clear logs error:', error);
    res.status(500).json({ error: 'Error al limpiar logs' });
  }
});

/**
 * @description Obtiene estadísticas sobre los archivos de logs en disco.
 * @route GET /api/admin/logs/stats
 * @access Private (Admin)
 * @returns {Object} 200 - Tamaños de archivos y conteo de líneas.
 */
router.get('/logs/stats', requireAdmin, async (req, res) => {
  try {
    const stats = logBuffer.getFileStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadisticas de logs' });
  }
});

/**
 * @description Descarga un archivo de log específico (full o important).
 * @route GET /api/admin/logs/download/:type
 * @access Private (Admin)
 * @returns {File} 200 - Contenido del archivo de log.
 * @returns {Object} 400 - Tipo inválido.
 * @returns {Object} 404 - No hay logs disponibles.
 */
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

    const filename = logBuffer.getDownloadFileName(type);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: 'Error al descargar logs' });
  }
});

/**
 * @description Lista los archivos de log archivados.
 * @route GET /api/admin/logs/archives
 * @access Private (Admin)
 * @returns {Object} 200 - Lista de nombres de archivos.
 */
router.get('/logs/archives', requireAdmin, async (req, res) => {
  try {
    const archives = logBuffer.getArchiveFiles();
    res.json({ archives });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener archivos' });
  }
});

/**
 * @description Descarga un archivo de log archivado específico.
 * @route GET /api/admin/logs/archives/:filename
 * @access Private (Admin)
 * @returns {File} 200 - Contenido del archivo.
 * @returns {Object} 400 - Nombre de archivo inválido.
 * @returns {Object} 404 - Archivo no encontrado.
 */
router.get('/logs/archives/:filename', requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename.endsWith('.txt') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Nombre de archivo invalido' });
    }
    const content = logBuffer.getArchiveContent(filename);
    if (!content) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

/**
 * @description Reinicia completamente el sistema de despacho.
 * Elimina paradas, rutas, direcciones validadas, historial y fotos.
 * OPERACIÓN CRÍTICA E IRREVERSIBLE.
 * @route DELETE /api/admin/dispatch/reset
 * @access Private (Admin)
 * @returns {Object} 200 - Conteo de entidades eliminadas.
 */
router.delete('/dispatch/reset', requireAdmin, async (req, res) => {
  try {
    const stopsDeleted = await Stop.destroy({ where: {} });
    const routesDeleted = await Route.destroy({ where: {} });
    const addressesDeleted = await ValidatedAddress.destroy({ where: {} });

    let routeHistoryDeleted = 0;
    try {
      const { sequelize } = await import('../models/index.js');
      const [, meta] = await sequelize.query('DELETE FROM route_history');
      routeHistoryDeleted = meta?.rowCount || 0;
    } catch (e) {}

    const evidencePath = path.join(process.cwd(), 'uploads', 'evidence');
    let photosDeleted = 0;
    if (fs.existsSync(evidencePath)) {
      const files = fs.readdirSync(evidencePath);
      for (const file of files) {
        if (file === '.gitkeep') continue;
        fs.unlinkSync(path.join(evidencePath, file));
        photosDeleted++;
      }
    }

    console.log(`[Admin] Dispatch vaciado: ${addressesDeleted} direcciones, ${routesDeleted} rutas, ${stopsDeleted} paradas, ${routeHistoryDeleted} historial, ${photosDeleted} fotos eliminadas`);

    res.json({
      success: true,
      deleted: {
        addresses: addressesDeleted,
        routes: routesDeleted,
        stops: stopsDeleted,
        routeHistory: routeHistoryDeleted,
        photos: photosDeleted
      }
    });
  } catch (error) {
    console.error('Reset dispatch error:', error);
    res.status(500).json({ error: 'Error al vaciar dispatch' });
  }
});

/**
 * @description Exporta registros del dispatcher a un archivo Excel.
 * Permite filtrar por dispatch_status (múltiples estados separados por coma).
 * @route GET /api/admin/dispatch/export
 * @access Private (Admin)
 * @param {string} [req.query.statuses] - Estados a exportar (ej: "available,assigned,delivered")
 * @returns {Buffer} 200 - Archivo .xlsx para descarga
 */
router.get('/dispatch/export', requireAdmin, async (req, res) => {
  try {
    const rawStatuses = req.query.statuses || 'available,assigned,delivered,archived';
    const statuses = rawStatuses.split(',').map(s => s.trim()).filter(Boolean);

    const VALID_STATUSES = ['available', 'assigned', 'delivered', 'archived'];
    const filteredStatuses = statuses.filter(s => VALID_STATUSES.includes(s));
    if (filteredStatuses.length === 0) {
      return res.status(400).json({ error: 'Sin estados válidos para exportar' });
    }

    const records = await ValidatedAddress.findAll({
      where: { dispatch_status: { [Op.in]: filteredStatuses } },
      order: [['created_at', 'DESC']]
    });

    const DISPATCH_STATUS_LABELS = {
      available: 'Disponible',
      assigned: 'Asignado',
      delivered: 'Entregado',
      archived: 'Archivado'
    };
    const ORDER_STATUS_LABELS = {
      approved: 'Aprobado',
      pending: 'Pendiente',
      ordered: 'Ordenado',
      pickup_ready: 'Listo para recoger',
      on_delivery: 'En camino',
      ups_shipped: 'UPS Enviado',
      delivered: 'Entregado'
    };
    const PAYMENT_STATUS_LABELS = {
      pending: 'Pendiente',
      paid: 'Pagado'
    };

    const formatDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };
    const formatMoney = (v) => (v !== null && v !== undefined) ? Number(v).toFixed(2) : '';

    const rows = records.map(r => ({
      'ID': r.id,
      'Nombre Cliente': r.customer_name || '',
      'Teléfono': r.customer_phone || '',
      'Dirección Validada': r.validated_address || '',
      'Dirección Original': r.original_address || '',
      'Apartamento': r.apartment_number || '',
      'Ciudad': r.city || '',
      'Estado': r.state || '',
      'ZIP': r.zip_code || '',
      'Estado Despacho': DISPATCH_STATUS_LABELS[r.dispatch_status] || r.dispatch_status || '',
      'Estado Orden': ORDER_STATUS_LABELS[r.order_status] || r.order_status || '',
      'Costo ($)': formatMoney(r.order_cost),
      'Depósito ($)': formatMoney(r.deposit_amount),
      'Por Cobrar ($)': formatMoney(r.total_to_collect),
      'Cobrado ($)': formatMoney(r.amount_collected),
      'Método Pago': r.payment_method || '',
      'Estado Pago': PAYMENT_STATUS_LABELS[r.payment_status] || r.payment_status || '',
      'Driver': r.driver_name || '',
      'Notas': r.notes || '',
      'Fuente': r.source || '',
      'Fecha Creación': formatDate(r.created_at),
      'Fecha Entrega': formatDate(r.delivered_at)
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 6 },  // ID
      { wch: 28 }, // Nombre
      { wch: 16 }, // Teléfono
      { wch: 40 }, // Dir Validada
      { wch: 35 }, // Dir Original
      { wch: 12 }, // Apt
      { wch: 18 }, // Ciudad
      { wch: 8 },  // Estado
      { wch: 8 },  // ZIP
      { wch: 14 }, // Estado Despacho
      { wch: 16 }, // Estado Orden
      { wch: 10 }, // Costo
      { wch: 10 }, // Depósito
      { wch: 12 }, // Por Cobrar
      { wch: 10 }, // Cobrado
      { wch: 12 }, // Método Pago
      { wch: 12 }, // Estado Pago
      { wch: 20 }, // Driver
      { wch: 30 }, // Notas
      { wch: 14 }, // Fuente
      { wch: 18 }, // Fecha Creación
      { wch: 18 }  // Fecha Entrega
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Dispatcher');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `dispatcher_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (error) {
    console.error('Export dispatch error:', error);
    res.status(500).json({ error: 'Error al exportar datos' });
  }
});

export default router;
