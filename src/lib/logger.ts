import { db } from './db';
import { useConfigStore } from './store';

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
    console.log(`[${module}] INFO: ${message}`, details || '');
    this.write('info', module, message, details);
  }

  warn(module: string, message: string, details?: any) {
    console.warn(`[${module}] WARN: ${message}`, details || '');
    this.write('warn', module, message, details);
  }

  error(module: string, message: string, details?: any) {
    console.error(`[${module}] ERROR: ${message}`, details || '');
    this.write('error', module, message, details);
  }
}

export const appLogger = new Logger();
