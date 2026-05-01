/**
 * Error Logger - Abstração para logging de erros
 * Pode ser facilmente integrada com Sentry, LogRocket, Bugsnag, etc.
 */

export interface ErrorLogContext {
  componentStack?: string;
  userId?: string;
  route?: string;
  timestamp?: string;
  extra?: Record<string, unknown>;
}

export interface ErrorLogger {
  captureError: (error: Error, context?: ErrorLogContext) => void;
  captureMessage: (message: string, level?: "info" | "warning" | "error") => void;
  setUser: (userId: string | null) => void;
}

// Logger padrão - console (desenvolvimento)
const consoleLogger: ErrorLogger = {
  captureError: (error, context) => {
    console.error("[ErrorLogger] Error captured:", {
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    });
  },
  captureMessage: (message, level = "info") => {
    const logFn = level === "error" ? console.error : level === "warning" ? console.warn : console.log;
    logFn(`[ErrorLogger] ${level.toUpperCase()}: ${message}`);
  },
  setUser: (userId) => {
    console.log("[ErrorLogger] User set:", userId);
  },
};

// Placeholder para Sentry - descomente e configure quando tiver o DSN
/*
import * as Sentry from "@sentry/react";

const sentryLogger: ErrorLogger = {
  captureError: (error, context) => {
    Sentry.captureException(error, {
      extra: context,
    });
  },
  captureMessage: (message, level = "info") => {
    Sentry.captureMessage(message, level);
  },
  setUser: (userId) => {
    Sentry.setUser(userId ? { id: userId } : null);
  },
};

// Inicialização do Sentry
export function initSentry(dsn: string) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
*/

// Logger ativo - troque para sentryLogger quando configurar Sentry
let activeLogger: ErrorLogger = consoleLogger;

export function setErrorLogger(logger: ErrorLogger) {
  activeLogger = logger;
}

export function resetErrorLogger() {
  activeLogger = consoleLogger;
}

export function getErrorLogger(): ErrorLogger {
  return activeLogger;
}

// Funções de conveniência
export function captureError(error: Error, context?: ErrorLogContext) {
  activeLogger.captureError(error, {
    ...context,
    timestamp: new Date().toISOString(),
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
  });
}

export function captureMessage(message: string, level?: "info" | "warning" | "error") {
  activeLogger.captureMessage(message, level);
}

export function setErrorUser(userId: string | null) {
  activeLogger.setUser(userId);
}
