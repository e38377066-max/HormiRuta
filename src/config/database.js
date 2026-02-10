import { Sequelize } from 'sequelize';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL no esta configurada en las variables de entorno');
  console.error('Copia .env.example a .env y configura DATABASE_URL');
  process.exit(1);
}

const useSSL = process.env.DATABASE_SSL === 'true' || 
  (databaseUrl.includes('neon.tech') || databaseUrl.includes('rds.amazonaws.com') || databaseUrl.includes('supabase'));

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: useSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
});

export default sequelize;
