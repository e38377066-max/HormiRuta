/**
 * @fileoverview Configuración de la conexión a la base de datos PostgreSQL usando Sequelize.
 * Gestiona la URL de conexión, opciones de SSL y el pool de conexiones.
 */

import { Sequelize } from 'sequelize';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL no esta configurada en las variables de entorno');
  console.error('Copia .env.example a .env y configura DATABASE_URL');
  process.exit(1);
}

/**
 * Determina si se debe usar SSL para la conexión a la base de datos.
 * Se habilita si DATABASE_SSL es 'true' o si el host pertenece a proveedores conocidos que lo requieren.
 */
const useSSL = process.env.DATABASE_SSL === 'true' || 
  (databaseUrl.includes('neon.tech') || databaseUrl.includes('rds.amazonaws.com') || databaseUrl.includes('supabase'));

/**
 * Instancia de Sequelize configurada para PostgreSQL.
 */
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
