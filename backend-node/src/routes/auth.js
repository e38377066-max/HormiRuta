import { Router } from 'express';
import { User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';

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
    
    req.session.userId = user.id;
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
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
    
    req.session.userId = user.id;
    
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: user.toDict()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.json({ success: true, message: 'Sesión cerrada' });
  });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user: user.toDict() });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

router.put('/update', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
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
