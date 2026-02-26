import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

class LogBuffer {
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
  }

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

  _isImportant(entry) {
    if (entry.level === 'error' || entry.level === 'warn') return true;
    const msg = entry.message.toLowerCase();
    if (msg.includes('iniciar') || msg.includes('servidor')) return true;
    if (msg.includes('actualizada') || msg.includes('actualizado')) return true;
    if (msg.includes('nueva direccion') || msg.includes('geocoding')) return true;
    if (msg.includes('lifecycle sync')) return true;
    if (msg.includes('cobertura') || msg.includes('coverage')) return true;
    if (msg.includes('polling') && (msg.includes('start') || msg.includes('stop'))) return true;
    if (msg.includes('orden') || msg.includes('order')) return true;
    if (msg.includes('asigna') || msg.includes('assign')) return true;
    if (msg.includes('contactos actualizados')) return true;
    if (msg.includes('nombre actualizado')) return true;
    if (msg.includes('google maps')) return true;
    if (msg.includes('ubicacion')) return true;
    return false;
  }

  _cleanOldEntries() {
    try {
      this._trimFile(this.fullLogFile, 3 * 24 * 60 * 60 * 1000);
      this._trimFile(this.importantLogFile, 24 * 60 * 60 * 1000);
    } catch {
    }
  }

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

  getFileContent(type = 'full') {
    const filePath = type === 'important' ? this.importantLogFile : this.fullLogFile;
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

  clear() {
    this.logs = [];
  }
}

const logBuffer = new LogBuffer(500);

export default logBuffer;
