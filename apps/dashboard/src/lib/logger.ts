/**
 * Debug Logger for RayLens
 * 
 * Captures all logs and makes them available in the UI console panel
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

type LogCallback = (entry: LogEntry) => void;

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private idCounter = 0;
  private listeners: Set<LogCallback> = new Set();

  constructor() {
    // Intercept console methods
    this.interceptConsole();
  }

  private interceptConsole(): void {
    const originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    // Wrap console methods to capture logs
    console.log = (...args) => {
      originalConsole.log(...args);
      this.capture('info', 'console', args);
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      this.capture('info', 'console', args);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      this.capture('warn', 'console', args);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      this.capture('error', 'console', args);
    };

    console.debug = (...args) => {
      originalConsole.debug(...args);
      this.capture('debug', 'console', args);
    };
  }

  private capture(level: LogLevel, source: string, args: unknown[]): void {
    // Format message
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }).join(' ');

    // Extract source from [Source] prefix if present
    const match = message.match(/^\[([^\]]+)\]\s*(.*)/s);
    const actualSource = match ? match[1] : source;
    const actualMessage = match ? match[2] : message;

    const entry: LogEntry = {
      id: ++this.idCounter,
      timestamp: new Date(),
      level,
      source: actualSource,
      message: actualMessage,
      data: args.length === 1 && typeof args[0] === 'object' ? args[0] : undefined,
    };

    this.logs.push(entry);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.listeners.forEach(cb => cb(entry));
  }

  /**
   * Log with specific source
   */
  log(level: LogLevel, source: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: ++this.idCounter,
      timestamp: new Date(),
      level,
      source,
      message,
      data,
    };

    this.logs.push(entry);
    this.listeners.forEach(cb => cb(entry));

    // Also log to actual console
    const consoleMethod = level === 'debug' ? 'debug' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';
    // Use original console to avoid infinite loop
    const msg = `[${source}] ${message}`;
    if (data !== undefined) {
      (console as unknown as Record<string, (...args: unknown[]) => void>)[consoleMethod](msg, data);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(l => l.level === level);
  }

  /**
   * Get logs filtered by source
   */
  getLogsBySource(source: string): LogEntry[] {
    return this.logs.filter(l => l.source.toLowerCase().includes(source.toLowerCase()));
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    this.listeners.forEach(cb => cb({
      id: ++this.idCounter,
      timestamp: new Date(),
      level: 'info',
      source: 'Logger',
      message: 'Logs cleared',
    }));
  }

  /**
   * Subscribe to new logs
   */
  subscribe(callback: LogCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience methods
export const logDebug = (source: string, message: string, data?: unknown) => 
  logger.log('debug', source, message, data);

export const logInfo = (source: string, message: string, data?: unknown) => 
  logger.log('info', source, message, data);

export const logWarn = (source: string, message: string, data?: unknown) => 
  logger.log('warn', source, message, data);

export const logError = (source: string, message: string, data?: unknown) => 
  logger.log('error', source, message, data);
