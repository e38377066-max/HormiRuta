import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { sequelize } from './models/index.js';

import authRoutes from './routes/auth.js';
import routesRoutes from './routes/routes.js';
import stopsRoutes from './routes/stops.js';
import historyRoutes from './routes/history.js';
import messagingRoutes from './routes/messaging.js';

const app = express();
const PORT = process.env.PORT || 8000;

const allowedOrigins = [
  `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost'}`,
  `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost'}:5000`,
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:9000',
  'capacitor://localhost',
  'http://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o.replace(':5000', '')))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET is required in production');
}

app.use(session({
  secret: sessionSecret || 'dev-secret-key-for-local-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
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
