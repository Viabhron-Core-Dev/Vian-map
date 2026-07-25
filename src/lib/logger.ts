import { db } from './db';
import { useConfigStore } from './store';

// Monkeypatch console for global interception
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

class Logger {
  private async write(level: 'info' | 'warn' | 'error', module: string, message: string, details?: any) {
    const { isLoggingEnabled } = useConfigStore.getState();
    if (!isLoggingEnabled) return;

    let detailsStr = '';
    if (details) {
      try {
        if (details instanceof Error) {
          detailsStr = details.message + '\\n' + details.stack;
        } else {
          detailsStr = typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details);
        }
      } catch (e) {
        detailsStr = '[Unserializable object]';
      }
    }

    try {
      await db.logs.add({
        timestamp: Date.now(),
        level,
        module,
        message,
        details: detailsStr
      });

      // Cleanup if logs get too huge (e.g. over 2000 records)
      const count = await db.logs.count();
      if (count > 2000) {
        const oldestLogs = await db.logs.orderBy('timestamp').limit(500).keys();
        await db.logs.bulkDelete(oldestLogs as number[]);
      }
    } catch (e) {
      console.error("Logger failed to write to DB", e);
    }
  }

  info(module: string, message: string, details?: any) {
    originalLog(`[${module}] INFO: ${message}`, details || '');
    this.write('info', module, message, details);
  }

  warn(module: string, message: string, details?: any) {
    originalWarn(`[${module}] WARN: ${message}`, details || '');
    this.write('warn', module, message, details);
  }

  error(module: string, message: string, details?: any) {
    originalError(`[${module}] ERROR: ${message}`, details || '');
    this.write('error', module, message, details);
  }
}

export const appLogger = new Logger();

console.log = (...args) => {
  originalLog.apply(console, args);
  const msg = args.map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
    catch(e) { return '[Unserializable object]'; }
  }).join(' ');
  appLogger.info('System', msg);
};

console.warn = (...args) => {
  originalWarn.apply(console, args);
  const msg = args.map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
    catch(e) { return '[Unserializable object]'; }
  }).join(' ');
  appLogger.warn('System', msg);
};

console.error = (...args) => {
  originalError.apply(console, args);
  const msg = args.map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
    catch(e) { return '[Unserializable object]'; }
  }).join(' ');
  appLogger.error('System', msg);
};
