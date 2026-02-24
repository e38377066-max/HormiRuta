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
    this._intercept();
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

    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      source
    });

    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
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

  clear() {
    this.logs = [];
  }
}

const logBuffer = new LogBuffer(500);

export default logBuffer;
