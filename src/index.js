import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('===========================================');
console.log('HormiRuta - Iniciando servidor...');
console.log('===========================================');
console.log('Variables de entorno cargadas:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'NO CONFIGURADA');
console.log('- SESSION_SECRET:', process.env.SESSION_SECRET ? 'Configurada' : 'NO CONFIGURADA');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- PORT:', process.env.PORT || '5000');
console.log('- SERVER_DOMAIN:', process.env.SERVER_DOMAIN || 'localhost');
console.log('===========================================');

import { sequelize } from './models/index.js';

import authRoutes from './routes/auth.js';
import routesRoutes from './routes/routes.js';
import stopsRoutes from './routes/stops.js';
import historyRoutes from './routes/history.js';
import messagingRoutes from './routes/messaging.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  `https://${process.env.SERVER_DOMAIN || 'localhost'}`,
  `https://${process.env.SERVER_DOMAIN || 'localhost'}:5000`,
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:9000',
  'capacitor://localhost',
  'http://localhost'
];

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET is required in production');
}

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
  secret: sessionSecret || 'dev-secret-key-for-local-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HormiRuta API funcionando (Node.js)' });
});

app.use('/api/auth', authRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/stops', stopsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/admin', adminRoutes);

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath, { 
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized.');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`HormiRuta API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
