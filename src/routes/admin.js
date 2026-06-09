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

// ── Shared helpers for export ──────────────────────────────────────────────
const VALID_DISPATCH_STATUSES = ['available', 'assigned', 'delivered', 'archived'];
const VALID_ORDER_STATUSES = ['approved', 'pending', 'ordered', 'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'];

const DISPATCH_STATUS_LABELS = {
  available: 'Disponible', assigned: 'Asignado',
  delivered: 'Entregado', archived: 'Archivado'
};
const ORDER_STATUS_LABELS = {
  approved: 'Aprobado', pending: 'Pendiente', ordered: 'Ordenado',
  pickup_ready: 'Listo para recoger', on_delivery: 'En camino',
  ups_shipped: 'UPS Enviado', delivered: 'Entregado'
};
const PAYMENT_STATUS_LABELS = { pending: 'Pendiente', paid: 'Pagado' };

// Todas las columnas posibles: key → { header, width, getter }
const ALL_COLUMNS = {
  customer_name:     { header: 'Nombre Cliente',     width: 28, get: r => r.customer_name || '' },
  customer_phone:    { header: 'Teléfono',           width: 16, get: r => r.customer_phone || '' },
  validated_address: { header: 'Dirección Validada', width: 40, get: r => r.validated_address || '' },
  original_address:  { header: 'Dirección Original', width: 35, get: r => r.original_address || '' },
  apartment_number:  { header: 'Apartamento',        width: 12, get: r => r.apartment_number || '' },
  city:              { header: 'Ciudad',             width: 18, get: r => r.city || '' },
  state:             { header: 'Estado',             width: 8,  get: r => r.state || '' },
  zip_code:          { header: 'ZIP',                width: 8,  get: r => r.zip_code || '' },
  dispatch_status:   { header: 'Estado Despacho',   width: 14, get: r => DISPATCH_STATUS_LABELS[r.dispatch_status] || r.dispatch_status || '' },
  order_status:      { header: 'Estado Orden',      width: 16, get: r => ORDER_STATUS_LABELS[r.order_status] || r.order_status || '' },
  order_cost:        { header: 'Costo ($)',          width: 10, get: r => r.order_cost != null ? Number(r.order_cost).toFixed(2) : '' },
  deposit_amount:    { header: 'Depósito ($)',       width: 10, get: r => r.deposit_amount != null ? Number(r.deposit_amount).toFixed(2) : '' },
  total_to_collect:  { header: 'Por Cobrar ($)',     width: 12, get: r => r.total_to_collect != null ? Number(r.total_to_collect).toFixed(2) : '' },
  amount_collected:  { header: 'Cobrado ($)',        width: 10, get: r => r.amount_collected != null ? Number(r.amount_collected).toFixed(2) : '' },
  payment_method:    { header: 'Método Pago',        width: 12, get: r => r.payment_method || '' },
  payment_status:    { header: 'Estado Pago',        width: 12, get: r => PAYMENT_STATUS_LABELS[r.payment_status] || r.payment_status || '' },
  driver_name:       { header: 'Driver',             width: 20, get: r => r.driver_name || '' },
  notes:             { header: 'Notas',              width: 30, get: r => r.notes || '' },
  source:            { header: 'Fuente',             width: 14, get: r => r.source || '' },
  created_at:        { header: 'Fecha Creación',     width: 18, get: r => r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' },
  delivered_at:      { header: 'Fecha Entrega',      width: 18, get: r => r.delivered_at ? new Date(r.delivered_at).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' }
};

function buildExportWhere(req) {
  const rawStatuses = (req.query.statuses || '').split(',').map(s => s.trim()).filter(Boolean);
  const dispatchStatuses = rawStatuses.filter(s => VALID_DISPATCH_STATUSES.includes(s));

  const rawOrder = (req.query.orderStatuses || '').split(',').map(s => s.trim()).filter(Boolean);
  const orderStatuses = rawOrder.filter(s => VALID_ORDER_STATUSES.includes(s));

  if (dispatchStatuses.length === 0) return null;

  const where = { dispatch_status: { [Op.in]: dispatchStatuses } };
  if (orderStatuses.length > 0) {
    where.order_status = { [Op.in]: orderStatuses };
  }
  return where;
}

/**
 * @description Devuelve el conteo de registros según los filtros de exportación.
 * @route GET /api/admin/dispatch/export-count
 * @access Private (Admin)
 */
router.get('/dispatch/export-count', requireAdmin, async (req, res) => {
  try {
    const where = buildExportWhere(req);
    if (!where) return res.json({ count: 0 });
    const count = await ValidatedAddress.count({ where });
    res.json({ count });
  } catch (error) {
    console.error('Export count error:', error);
    res.status(500).json({ error: 'Error al contar registros' });
  }
});

/**
 * @description Exporta registros del dispatcher a un archivo Excel.
 * Permite filtrar por dispatch_status, order_status y elegir columnas específicas.
 * @route GET /api/admin/dispatch/export
 * @access Private (Admin)
 * @param {string} [req.query.statuses] - Estados de despacho (ej: "available,assigned")
 * @param {string} [req.query.orderStatuses] - Estados de orden (ej: "approved,ordered")
 * @param {string} [req.query.columns] - Columnas a incluir (ej: "customer_name,validated_address")
 * @returns {Buffer} 200 - Archivo .xlsx para descarga
 */
router.get('/dispatch/export', requireAdmin, async (req, res) => {
  try {
    const where = buildExportWhere(req);
    if (!where) {
      return res.status(400).json({ error: 'Sin estados de despacho válidos para exportar' });
    }

    // Columnas solicitadas — si no se pasa nada se exportan todas
    const rawCols = (req.query.columns || '').split(',').map(s => s.trim()).filter(Boolean);
    const colKeys = rawCols.length > 0
      ? rawCols.filter(k => ALL_COLUMNS[k])
      : Object.keys(ALL_COLUMNS);

    if (colKeys.length === 0) {
      return res.status(400).json({ error: 'Sin columnas válidas para exportar' });
    }

    const records = await ValidatedAddress.findAll({ where, order: [['created_at', 'DESC']] });

    const rows = records.map(r => {
      const row = {};
      for (const key of colKeys) {
        row[ALL_COLUMNS[key].header] = ALL_COLUMNS[key].get(r);
      }
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = colKeys.map(k => ({ wch: ALL_COLUMNS[k].width }));
    XLSX.utils.book_append_sheet(wb, ws, 'Dispatcher');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `dispatcher_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (error) {
    console.error('Export dispatch error:', error);
    res.status(500).json({ error: 'Error al exportar datos' });
  }
});

export default router;
