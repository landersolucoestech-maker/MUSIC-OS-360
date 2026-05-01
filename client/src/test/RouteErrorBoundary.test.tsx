// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import React from 'react';
import { RouteErrorBoundary } from '@/components/shared/RouteErrorBoundary';

// Componente que lança erro para testar
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Route error');
  }
  return <div>Route content</div>;
}

describe('RouteErrorBoundary', () => {
  const originalError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <div>Route content</div>
        </RouteErrorBoundary>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Route content')).toBeInTheDocument();
  });

  it('renders error fallback when error occurs', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <ThrowError shouldThrow={true} />
        </RouteErrorBoundary>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(screen.queryByText('Route content')).not.toBeInTheDocument();
  });

  it('shows retry and home buttons in error state', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <ThrowError shouldThrow={true} />
        </RouteErrorBoundary>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
    expect(screen.getByText('Ir para o início')).toBeInTheDocument();
  });

  it('resets when route changes', () => {
    function NavButton() {
      const navigate = useNavigate();
      return (
        <button onClick={() => navigate('/page2')}>nav-to-page2</button>
      );
    }

    render(
      <MemoryRouter initialEntries={['/page1']}>
        <NavButton />
        <RouteErrorBoundary>
          <Routes>
            <Route path="/page1" element={<ThrowError shouldThrow={true} />} />
            <Route path="/page2" element={<ThrowError shouldThrow={false} />} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();

    fireEvent.click(screen.getByText('nav-to-page2'));

    expect(screen.getByText('Route content')).toBeInTheDocument();
    expect(screen.queryByText('Algo deu errado')).not.toBeInTheDocument();
  });
});
