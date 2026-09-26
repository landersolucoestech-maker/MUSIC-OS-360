// ─── Logger interface (isomorphic: browser + Node) ───────────────────────────
// In the browser: uses colored console.*.
// On the server: implemented by the consumer with Pino or Winston.

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  module?: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface Logger {
  trace(msg: string, ctx?: LogContext): void;
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
  fatal(msg: string, ctx?: LogContext): void;
  child(ctx: LogContext): Logger;
}

// ─── Console logger (browser / fallback) ─────────────────────────────────────

const LOG_COLORS: Record<LogLevel, string> = {
  trace: "#94a3b8",
  debug: "#60a5fa",
  info: "#34d399",
  warn: "#fbbf24",
  error: "#f87171",
  fatal: "#c026d3",
};

function consoleLog(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (typeof window === "undefined") return; // No-op no server (usa Pino)
  const color = LOG_COLORS[level];
  const prefix = ctx?.module ? `[${ctx.module}]` : "[music-os]";
  const style = `color: ${color}; font-weight: bold`;
  if (ctx && Object.keys(ctx).length > 0) {
    console[level === "fatal" || level === "error" ? "error" : level === "warn" ? "warn" : "log"](
      `%c${prefix} ${msg}`,
      style,
      ctx,
    );
  } else {
    console[level === "fatal" || level === "error" ? "error" : level === "warn" ? "warn" : "log"](
      `%c${prefix} ${msg}`,
      style,
    );
  }
}

function createConsoleLogger(baseCtx: LogContext = {}): Logger {
  const logger: Logger = {
    trace: (msg, ctx) => consoleLog("trace", msg, { ...baseCtx, ...ctx }),
    debug: (msg, ctx) => consoleLog("debug", msg, { ...baseCtx, ...ctx }),
    info: (msg, ctx) => consoleLog("info", msg, { ...baseCtx, ...ctx }),
    warn: (msg, ctx) => consoleLog("warn", msg, { ...baseCtx, ...ctx }),
    error: (msg, ctx) => consoleLog("error", msg, { ...baseCtx, ...ctx }),
    fatal: (msg, ctx) => consoleLog("fatal", msg, { ...baseCtx, ...ctx }),
    child: (ctx) => createConsoleLogger({ ...baseCtx, ...ctx }),
  };
  return logger;
}

export const logger: Logger = createConsoleLogger();

export { createConsoleLogger };
