import { Sequelize } from 'sequelize';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL no esta configurada en las variables de entorno');
  console.error('Copia .env.example a .env y configura DATABASE_URL');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

export default sequelize;
