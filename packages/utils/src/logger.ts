/**
 * Simple logging utility to replace console.log
 * Filters sensitive data and provides structured logging
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  filterSensitive: boolean;
}

const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  enableColors: true,
  filterSensitive: true,
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Sensitive field patterns to filter
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credential/i,
  /key/i,
];

/**
 * Filter sensitive data from objects
 */
function filterSensitive(data: any): any {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(filterSensitive);
  }

  const filtered: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
      filtered[key] = value ? "***REDACTED***" : value;
    } else if (typeof value === "object") {
      filtered[key] = filterSensitive(value);
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data === undefined) {
      return `${prefix} ${message}`;
    }

    const safeData = this.config.filterSensitive ? filterSensitive(data) : data;
    const dataStr = typeof safeData === "object"
      ? JSON.stringify(safeData, null, 2)
      : String(safeData);

    return `${prefix} ${message}\n${dataStr}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog("error")) {
      const errorData = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(this.formatMessage("error", message, errorData));
    }
  }

  /**
   * Update logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for custom instances
export { Logger };
