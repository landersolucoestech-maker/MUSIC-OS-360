import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Polyfills usados por componentes Radix em ambiente jsdom
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const g = globalThis as unknown as { ResizeObserver?: unknown };
if (typeof g.ResizeObserver === 'undefined') {
  g.ResizeObserver = ResizeObserverPolyfill;
}

// jsdom não implementa scrollIntoView nem PointerEvent helpers usados por Radix Select.
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.scrollIntoView) {
    proto.scrollIntoView = function () {};
  }
  if (!proto.hasPointerCapture) {
    proto.hasPointerCapture = function () { return false; };
  }
  if (!proto.releasePointerCapture) {
    proto.releasePointerCapture = function () {};
  }
  if (!proto.setPointerCapture) {
    proto.setPointerCapture = function () {};
  }
}

// Limpa o DOM após cada teste
afterEach(() => {
  cleanup();
});
