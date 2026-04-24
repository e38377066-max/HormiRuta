import 'dotenv/config';
import logBuffer from './services/logService.js';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('===========================================');
console.log('Area 862 System - Iniciando servidor...');
console.log('===========================================');
console.log('Variables de entorno cargadas:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'NO CONFIGURADA');
console.log('- SESSION_SECRET:', process.env.SESSION_SECRET ? 'Configurada' : 'NO CONFIGURADA');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- PORT:', process.env.PORT || '5000');
console.log('- SERVER_DOMAIN:', process.env.SERVER_DOMAIN || 'localhost');
console.log('===========================================');

import { sequelize } from './models/index.js';

import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import routesRoutes from './routes/routes.js';
import stopsRoutes from './routes/stops.js';
import historyRoutes from './routes/history.js';
import messagingRoutes from './routes/messaging.js';
import adminRoutes from './routes/admin.js';
import dispatchRoutes from './routes/dispatch.js';
import pollingService from './services/pollingService.js';
import emailRoutes from './routes/email.js';
import wholesaleRoutes from './routes/wholesale.js';
import botMemoryRoutes from './routes/botMemory.js';
import aiLearningRoutes from './routes/aiLearning.js';
import StyleLearningService from './services/styleLearningService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
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
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Area 862 System API funcionando (Node.js)' });
});

app.use('/api/auth', authRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/stops', stopsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/wholesale', wholesaleRoutes);
app.use('/api/bot-memory', botMemoryRoutes);
app.use('/api/ai-learning', aiLearningRoutes);

// Uploads contiene evidencia de entrega, reportes y archivos con PII.
// Gating con autenticacion para que solo usuarios logueados puedan descargarlos.
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', requireAuth, express.static(uploadsPath));

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
    
    await sequelize.sync({ alter: { drop: false } });
    console.log('Database tables synchronized.');

    // Secuencial para evitar carrera: primero reconcile (puede reactivar
    // entregadas que el cliente volvio a pedir), despues cleanup (archiva
    // entregadas viejas). Si cleanup corriera en paralelo podria re-archivar
    // una orden recien reactivada por el reconcile.
    (async () => {
      try {
        await pollingService.reconcileLifecyclesOnStartup();
      } catch (e) {
        console.error('[StartupReconcile] Error inicial:', e.message);
      }
      try {
        await pollingService.cleanupDeliveredOrders();
      } catch (e) {
        console.error('[Cleanup] Error inicial:', e.message);
      }
    })();

    // Inicia el aprendizaje periódico del estilo de los agentes (cada hora, primera vez a los 5 min)
    StyleLearningService.startScheduler();
    console.log('[StyleLearning] Scheduler iniciado.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Area 862 System API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
