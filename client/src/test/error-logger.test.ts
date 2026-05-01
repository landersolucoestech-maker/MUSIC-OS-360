// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  captureError, 
  captureMessage, 
  setErrorUser, 
  setErrorLogger,
  resetErrorLogger,
  getErrorLogger,
  ErrorLogger 
} from '@/lib/error-logger';

describe('error-logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetErrorLogger();
  });

  it('logs errors to console by default', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const testError = new Error('Test error');
    captureError(testError);
    
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain('[ErrorLogger]');
    
    consoleSpy.mockRestore();
  });

  it('logs messages with correct level', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    captureMessage('Info message', 'info');
    expect(consoleLogSpy).toHaveBeenCalled();
    
    captureMessage('Warning message', 'warning');
    expect(consoleWarnSpy).toHaveBeenCalled();
    
    captureMessage('Error message', 'error');
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('can set custom error logger', () => {
    const customLogger: ErrorLogger = {
      captureError: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
    };
    
    setErrorLogger(customLogger);
    
    const testError = new Error('Test');
    captureError(testError);
    
    expect(customLogger.captureError).toHaveBeenCalled();
  });

  it('sets user in logger', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    setErrorUser('user-123');
    
    expect(consoleLogSpy).toHaveBeenCalledWith('[ErrorLogger] User set:', 'user-123');
    
    consoleLogSpy.mockRestore();
  });

  it('includes timestamp in error context', () => {
    const customLogger: ErrorLogger = {
      captureError: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
    };
    
    setErrorLogger(customLogger);
    
    captureError(new Error('Test'));
    
    expect(customLogger.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        timestamp: expect.any(String),
      })
    );
  });

  it('getErrorLogger returns current logger', () => {
    const logger = getErrorLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.captureError).toBe('function');
    expect(typeof logger.captureMessage).toBe('function');
    expect(typeof logger.setUser).toBe('function');
  });
});
