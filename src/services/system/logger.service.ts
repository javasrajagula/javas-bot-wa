import { env } from '../../config/env.js';
import { redactSensitive } from '../../utils/mask.util.js';
import { LogLevel } from '../../utils/logger.js';

class LoggerService {
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    const configured = env.LOG_LEVEL || 'info';
    const mapping: Record<string, LogLevel> = {
      silent: LogLevel.SILENT,
      error: LogLevel.ERROR,
      warn: LogLevel.WARN,
      info: LogLevel.INFO,
      debug: LogLevel.DEBUG,
    };
    this.level = mapping[configured] ?? LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.level >= level;
  }

  public error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${this.formatMessage(message)}`, ...this.formatArgs(args));
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${this.formatMessage(message)}`, ...this.formatArgs(args));
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`[INFO] ${this.formatMessage(message)}`, ...this.formatArgs(args));
    }
  }

  public debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[DEBUG] ${this.formatMessage(message)}`, ...this.formatArgs(args));
    }
  }

  public secure(message: string, data: any, level: LogLevel = LogLevel.INFO): void {
    if (this.shouldLog(level)) {
      const redacted = redactSensitive(data);
      const formatted = typeof redacted === 'object' ? JSON.stringify(redacted) : String(redacted);
      
      const prefix = level === LogLevel.ERROR ? '[SECURE-ERROR]' 
                   : level === LogLevel.WARN ? '[SECURE-WARN]'
                   : level === LogLevel.DEBUG ? '[SECURE-DEBUG]'
                   : '[SECURE-INFO]';
      
      if (level === LogLevel.ERROR) {
        console.error(`${prefix} ${message}:`, formatted);
      } else if (level === LogLevel.WARN) {
        console.warn(`${prefix} ${message}:`, formatted);
      } else if (level === LogLevel.DEBUG) {
        console.debug(`${prefix} ${message}:`, formatted);
      } else {
        console.log(`${prefix} ${message}:`, formatted);
      }
    }
  }

  private formatMessage(msg: string): string {
    if (env.NODE_ENV === 'production') {
      return redactSensitive(msg);
    }
    return msg;
  }

  private formatArgs(args: any[]): any[] {
    if (env.NODE_ENV === 'production') {
      return args.map(arg => redactSensitive(arg));
    }
    return args;
  }
}

export const loggerService = new LoggerService();
export { LogLevel };
