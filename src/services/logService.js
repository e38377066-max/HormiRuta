/**
 * @fileoverview Servicio para la gestión y centralización de logs del sistema.
 * Proporciona un buffer en memoria, persistencia en archivos y rotación/archivado de logs.
 * Intercepta las llamadas a console.log, console.error, etc., para capturarlas.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Formatea una fecha en formato DD.MM.YYYY.
 * @description Formatea una instancia de Date para su uso en nombres de archivos de log.
 * @param {Date} date - La fecha a formatear.
 * @returns {string} La fecha formateada.
 */
function formatDate(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

/**
 * Clase LogBuffer para capturar, almacenar y persistir logs del sistema.
 * @description Maneja la interceptación de console, el filtrado de logs importantes y el mantenimiento de archivos.
 */
class LogBuffer {
  /**
   * Crea una instancia de LogBuffer.
   * @param {number} [maxEntries=500] - Número máximo de entradas a mantener en el buffer de memoria.
   */
  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
    this.logs = [];
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console)
    };

    this.fullLogFile = path.join(LOGS_DIR, 'full_log.jsonl');
    this.importantLogFile = path.join(LOGS_DIR, 'important_log.jsonl');

    this._cleanOldEntries();
    this._intercept();

    this._cleanupInterval = setInterval(() => this._cleanOldEntries(), 60 * 60 * 1000);
    this._archiveInterval = setInterval(() => this._dailyArchive(), 60 * 60 * 1000);
    this._dailyArchive();
  }

  /**
   * Intercepta los métodos globales de console.
   * @description Reemplaza console.log/error/warn/info para capturar sus salidas antes de pasarlas a la consola original.
   * @private
   */
  _intercept() {
    const self = this;

    console.log = (...args) => {
      self._capture('info', args);
      self.originalConsole.log(...args);
    };

    console.error = (...args) => {
      self._capture('error', args);
      self.originalConsole.error(...args);
    };

    console.warn = (...args) => {
      self._capture('warn', args);
      self.originalConsole.warn(...args);
    };

    console.info = (...args) => {
      self._capture('info', args);
      self.originalConsole.info(...args);
    };
  }

  /**
   * Captura una entrada de log.
   * @description Procesa los argumentos, detecta la fuente y almacena el log en memoria y disco.
   * @param {string} level - Nivel de log (info, error, warn).
   * @param {Array} args - Argumentos pasados al console.
   * @private
   */
  _capture(level, args) {
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.message;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const source = this._detectSource(message);
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }

    this._writeToFile(entry);
  }

  /**
   * Escribe una entrada de log en los archivos correspondientes.
   * @param {Object} entry - Objeto de entrada de log.
   * @private
   */
  _writeToFile(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.fullLogFile, line);

      if (this._isImportant(entry)) {
        fs.appendFileSync(this.importantLogFile, line);
      }
    } catch {
    }
  }

  /**
   * Determina si una entrada de log es importante.
   * @description Evalúa el nivel y el contenido del mensaje para decidir si debe guardarse en el log de importantes.
   * @param {Object} entry - Entrada de log.
   * @returns {boolean} True si es importante.
   * @private
   */
  _isImportant(entry) {
    if (entry.level === 'error' || entry.level === 'warn') return true;
    const msg = entry.message.toLowerCase();
    if (msg.includes('iniciar') || msg.includes('servidor')) return true;
    if (msg.includes('actualizada') || msg.includes('actualizado')) return true;
    if (msg.includes('nueva direccion') || msg.includes('geocoding')) return true;
    if (msg.includes('lifecycle')) return true;
    if (msg.includes('cobertura') || msg.includes('coverage')) return true;
    if (msg.includes('polling') && (msg.includes('start') || msg.includes('stop'))) return true;
    if (msg.includes('orden') || msg.includes('order')) return true;
    if (msg.includes('asigna') || msg.includes('assign')) return true;
    if (msg.includes('contactos actualizados')) return true;
    if (msg.includes('nombre actualizado') || msg.includes('nombre sync')) return true;
    if (msg.includes('google maps')) return true;
    if (msg.includes('ubicacion')) return true;
    return false;
  }

  /**
   * Limpia entradas antiguas de los archivos de log.
   * @private
   */
  _cleanOldEntries() {
    try {
      this._trimFile(this.fullLogFile, 3 * 24 * 60 * 60 * 1000);
      this._trimFile(this.importantLogFile, 24 * 60 * 60 * 1000);
    } catch {
    }
  }

  /**
   * Recorta un archivo de log basado en la antigüedad de las entradas.
   * @param {string} filePath - Ruta del archivo.
   * @param {number} maxAgeMs - Edad máxima permitida en milisegundos.
   * @private
   */
  _trimFile(filePath, maxAgeMs) {
    if (!fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

      const kept = lines.filter(line => {
        try {
          const entry = JSON.parse(line);
          return entry.timestamp >= cutoff;
        } catch {
          return false;
        }
      });

      fs.writeFileSync(filePath, kept.join('\n') + (kept.length > 0 ? '\n' : ''));
    } catch {
    }
  }

  /**
   * Realiza un archivado diario de los logs importantes y completos.
   * @private
   */
  _dailyArchive() {
    try {
      const now = new Date();
      const today = formatDate(now);
      const archiveDir = path.join(LOGS_DIR, 'archive');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const importantArchive = path.join(archiveDir, `${today}.txt`);
      if (!fs.existsSync(importantArchive) && fs.existsSync(this.importantLogFile)) {
        const content = this._formatLogFile(this.importantLogFile);
        if (content.trim()) {
          fs.writeFileSync(importantArchive, content);
        }
      }

      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      const startDay = String(threeDaysAgo.getDate()).padStart(2, '0');
      const startMonth = String(threeDaysAgo.getMonth() + 1).padStart(2, '0');
      const endDay = String(now.getDate()).padStart(2, '0');
      const endMonth = String(now.getMonth() + 1).padStart(2, '0');
      const endYear = now.getFullYear();
      const fullArchiveName = threeDaysAgo.getMonth() === now.getMonth()
        ? `${startDay}_${endDay}.${endMonth}.${endYear}.txt`
        : `${startDay}.${startMonth}_${endDay}.${endMonth}.${endYear}.txt`;
      const fullArchive = path.join(archiveDir, fullArchiveName);
      if (!fs.existsSync(fullArchive) && fs.existsSync(this.fullLogFile)) {
        const content = this._formatLogFile(this.fullLogFile);
        if (content.trim()) {
          fs.writeFileSync(fullArchive, content);
        }
      }

      this._cleanOldArchives(archiveDir);
    } catch {
    }
  }

  /**
   * Elimina archivos de archivado más antiguos de 7 días.
   * @param {string} archiveDir - Directorio de archivos.
   * @private
   */
  _cleanOldArchives(archiveDir) {
    try {
      const files = fs.readdirSync(archiveDir);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      files.forEach(file => {
        const filePath = path.join(archiveDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtime.getTime() < cutoff) {
          fs.unlinkSync(filePath);
        }
      });
    } catch {
    }
  }

  /**
   * Formatea un archivo de log JSONL a texto legible.
   * @param {string} filePath - Ruta del archivo.
   * @returns {string} Contenido formateado.
   * @private
   */
  _formatLogFile(filePath) {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(line => {
      try {
        const entry = JSON.parse(line);
        return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`;
      } catch {
        return line;
      }
    }).join('\n');
  }

  /**
   * Detecta el origen (fuente) de un mensaje de log.
   * @param {string} message - El mensaje a analizar.
   * @returns {string} El nombre de la fuente detectada.
   * @private
   */
  _detectSource(message) {
    if (message.includes('Database') || message.includes('sequelize') || message.includes('SQL')) return 'database';
    if (message.includes('/api/auth') || message.includes('auth') || message.includes('login')) return 'auth';
    if (message.includes('/api/messaging') || message.includes('messaging') || message.includes('respond.io')) return 'messaging';
    if (message.includes('/api/routes') || message.includes('route') || message.includes('optimization')) return 'routes';
    if (message.includes('/api/dispatch') || message.includes('dispatch')) return 'dispatch';
    if (message.includes('/api/admin') || message.includes('admin')) return 'admin';
    if (message.includes('polling') || message.includes('webhook')) return 'polling';
    if (message.includes('chatbot') || message.includes('bot')) return 'chatbot';
    if (message.includes('AddressScan') || message.includes('Geocoding') || message.includes('ValidatedAddr')) return 'scanner';
    return 'system';
  }

  /**
   * Obtiene logs filtrados y paginados desde el buffer de memoria.
   * @param {Object} options - Opciones de filtrado.
   * @param {string} [options.level] - Filtrar por nivel.
   * @param {string} [options.search] - Filtrar por texto.
   * @param {number} [options.limit=100] - Límite de resultados.
   * @param {number} [options.offset=0] - Desplazamiento para paginación.
   * @returns {Object} Un objeto con los logs y el total.
   */
  getLogs({ level, search, limit = 100, offset = 0 } = {}) {
    let filtered = [...this.logs];

    if (level && level !== 'all') {
      filtered = filtered.filter(l => l.level === level);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.message.toLowerCase().includes(searchLower) ||
        l.source.toLowerCase().includes(searchLower)
      );
    }

    filtered.reverse();

    const total = filtered.length;
    const paged = filtered.slice(Number(offset), Number(offset) + Number(limit));

    return { logs: paged, total };
  }

  /**
   * Genera el nombre de archivo para descarga.
   * @param {string} [type='full'] - Tipo de log (full o important).
   * @returns {string} El nombre del archivo.
   */
  getDownloadFileName(type = 'full') {
    const now = new Date();
    const today = formatDate(now);
    if (type === 'important') {
      return `${today}.txt`;
    }
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
    const startDay = String(threeDaysAgo.getDate()).padStart(2, '0');
    const startMonth = String(threeDaysAgo.getMonth() + 1).padStart(2, '0');
    const endDay = String(now.getDate()).padStart(2, '0');
    const endMonth = String(now.getMonth() + 1).padStart(2, '0');
    const endYear = now.getFullYear();
    if (threeDaysAgo.getMonth() === now.getMonth()) {
      return `${startDay}_${endDay}.${endMonth}.${endYear}.txt`;
    }
    return `${startDay}.${startMonth}_${endDay}.${endMonth}.${endYear}.txt`;
  }

  /**
   * Obtiene el contenido de un archivo de log formateado para lectura.
   * @param {string} [type='full'] - Tipo de log (full o important).
   * @returns {string} Contenido formateado.
   */
  getFileContent(type = 'full') {
    const filePath = type === 'important' ? this.importantLogFile : this.fullLogFile;
    return this._formatLogFile(filePath);
  }

  /**
   * Obtiene estadísticas de los archivos de log.
   * @returns {Object} Objeto con estadísticas de logs full e important.
   */
  getFileStats() {
    const stats = {};
    for (const [name, filePath] of [['full', this.fullLogFile], ['important', this.importantLogFile]]) {
      if (fs.existsSync(filePath)) {
        const fstat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lineCount = content.split('\n').filter(l => l.trim()).length;
        stats[name] = {
          size: fstat.size,
          sizeFormatted: fstat.size > 1024 * 1024 
            ? (fstat.size / (1024 * 1024)).toFixed(1) + ' MB' 
            : (fstat.size / 1024).toFixed(1) + ' KB',
          entries: lineCount,
          lastModified: fstat.mtime.toISOString()
        };
      } else {
        stats[name] = { size: 0, sizeFormatted: '0 KB', entries: 0, lastModified: null };
      }
    }
    return stats;
  }

  /**
   * Obtiene la lista de archivos archivados.
   * @returns {Array} Lista de archivos con su información.
   */
  getArchiveFiles() {
    const archiveDir = path.join(LOGS_DIR, 'archive');
    if (!fs.existsSync(archiveDir)) return [];
    return fs.readdirSync(archiveDir)
      .filter(f => f.endsWith('.txt'))
      .sort()
      .reverse()
      .map(f => {
        const stat = fs.statSync(path.join(archiveDir, f));
        return {
          name: f,
          size: stat.size,
          sizeFormatted: stat.size > 1024 * 1024 
            ? (stat.size / (1024 * 1024)).toFixed(1) + ' MB' 
            : (stat.size / 1024).toFixed(1) + ' KB',
          date: stat.mtime.toISOString()
        };
      });
  }

  /**
   * Obtiene el contenido de un archivo archivado específico.
   * @param {string} filename - Nombre del archivo.
   * @returns {string|null} Contenido del archivo o null si no existe.
   */
  getArchiveContent(filename) {
    const archiveDir = path.join(LOGS_DIR, 'archive');
    const filePath = path.join(archiveDir, filename);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Limpia el buffer de logs en memoria.
   */
  clear() {
    this.logs = [];
  }
}

const logBuffer = new LogBuffer(500);

export default logBuffer;

