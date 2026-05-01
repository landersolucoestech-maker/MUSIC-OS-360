// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ErrorFallback } from '@/components/shared/ErrorFallback';

describe('ErrorFallback', () => {
  const mockOnRetry = vi.fn();
  const mockOnGoHome = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error message', () => {
    render(<ErrorFallback />);
    
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(screen.getByText(/Ocorreu um erro inesperado/)).toBeInTheDocument();
  });

  it('shows retry button when onRetry is provided', () => {
    render(<ErrorFallback onRetry={mockOnRetry} />);
    
    const retryButton = screen.getByText('Tentar novamente');
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('shows go home button when onGoHome is provided', () => {
    render(<ErrorFallback onGoHome={mockOnGoHome} />);
    
    const homeButton = screen.getByText('Ir para o início');
    expect(homeButton).toBeInTheDocument();
    
    fireEvent.click(homeButton);
    expect(mockOnGoHome).toHaveBeenCalledTimes(1);
  });

  it('does not render buttons when handlers are not provided', () => {
    render(<ErrorFallback />);
    
    expect(screen.queryByText('Tentar novamente')).not.toBeInTheDocument();
    expect(screen.queryByText('Ir para o início')).not.toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    const testError = new Error('Test error message');
    
    render(<ErrorFallback error={testError} />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
});
