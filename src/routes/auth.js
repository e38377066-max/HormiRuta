import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { User, UserToken, DeliveryHistory, WholesaleClient, Route, Stop } from '../models/index.js';
import { requireAuth, generateToken, removeToken, getUserIdFromToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const { email, password, username, phone } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este email ya está registrado' });
    }
    
    const user = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null
    });
    
    await user.setPassword(password);
    await user.save();
    
    if (req.session) req.session.userId = user.id;
    const token = await generateToken(user.id);
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: user.toDict()
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ where: { email: normalizedEmail } });
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const isValid = await user.checkPassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    if (!user.active) {
      return res.status(401).json({ error: 'Esta cuenta está desactivada' });
    }
    
    if (req.session) req.session.userId = user.id;
    const token = await generateToken(user.id);
    
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: user.toDict()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    await removeToken(authHeader.slice(7));
  }
  if (req.session?.destroy) {
    req.session.destroy(() => {});
  }
  res.json({ success: true, message: 'Sesión cerrada' });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.userId || req.session?.userId;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user: user.toDict() });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Eliminar la propia cuenta del usuario autenticado (requerido por Apple App Store - guideline 5.1.1(v))
// Borra el usuario, todos sus datos personales y archivos de evidencia subidos.
//
// SEGURIDAD: este endpoint NO acepta sesión por cookie para evitar CSRF.
// Requiere explícitamente un Bearer token en el header Authorization
// (como hace el cliente móvil de Capacitor y la SPA web).
router.delete('/account', async (req, res) => {
  try {
    // 1) Autenticación SOLO por Bearer token (no cookies) — anti-CSRF
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Se requiere autenticación por token para esta acción' });
    }
    const token = authHeader.slice(7);
    const userId = await getUserIdFromToken(token);
    if (!userId) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 2) Recolectar y borrar archivos de evidencia en disco de TODAS las paradas del usuario
    //    (antes del destroy, para no perder los paths cuando cascada borre las filas).
    //    Defensa en profundidad contra path traversal: el cliente puede modificar photo_url
    //    via /api/stops, así que validamos estrictamente prefijo, ausencia de '..' y
    //    contención del path resuelto dentro de uploads/evidence/.
    try {
      const userRoutes = await Route.findAll({ where: { user_id: userId }, attributes: ['id'] });
      const routeIds = userRoutes.map(r => r.id);
      if (routeIds.length > 0) {
        const userStops = await Stop.findAll({
          where: { route_id: routeIds },
          attributes: ['photo_url']
        });
        const evidenceRoot = path.resolve(__dirname, '..', '..', 'uploads', 'evidence');
        const evidenceRootWithSep = evidenceRoot + path.sep;
        for (const stop of userStops) {
          const url = stop.photo_url;
          if (typeof url !== 'string' || !url) continue;
          // Allowlist estricto: debe empezar por /uploads/evidence/ y solo contener el filename.
          if (!url.startsWith('/uploads/evidence/')) continue;
          const filename = url.slice('/uploads/evidence/'.length);
          if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) continue;
          const filePath = path.resolve(evidenceRoot, filename);
          if (!filePath.startsWith(evidenceRootWithSep)) continue;
          if (!fs.existsSync(filePath)) continue;
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
    } catch (e) {
      console.error('Error limpiando archivos de evidencia:', e);
      // Continuamos: borrar la cuenta es más importante que limpiar archivos huérfanos.
    }

    // 3) Borrar entidades sin cascada automática
    await UserToken.destroy({ where: { user_id: userId } });
    await WholesaleClient.destroy({ where: { user_id: userId } });
    // DeliveryHistory usa driver_id (no user_id) — borrar lo que el usuario completó como conductor
    await DeliveryHistory.destroy({ where: { driver_id: userId } });

    // 4) Borrar el usuario — cascada elimina Routes, Stops, MessagingOrders, ConversationStates,
    //    MessageLogs, MessagingSettings, CoverageZones, ServiceAgents, ValidatedAddresses,
    //    BotMemories, BotKnowledge, CustomerProfiles, AgentStyleProfile, RouteHistory.
    await user.destroy();

    // 5) Cerrar sesión: revocar token y destruir cookie de sesión si existe
    try { await removeToken(token); } catch (e) {}
    if (req.session?.destroy) {
      req.session.destroy(() => {});
    }

    res.json({ success: true, message: 'Cuenta y todos los datos asociados eliminados permanentemente' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Error al eliminar la cuenta' });
  }
});

router.put('/update', requireAuth, async (req, res) => {
  try {
    const userId = req.userId || req.session?.userId;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const { username, phone, document, address } = req.body;
    
    if (username !== undefined) user.username = username.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (document !== undefined) user.document = document.trim();
    if (address !== undefined) user.address = address.trim();
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Datos actualizados',
      user: user.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

export default router;
