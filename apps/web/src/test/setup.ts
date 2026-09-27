import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installZodErrorMapPtBr } from '@/shared/lib/zod-pt-br';

// Same global zod error map as the app bootstrap (main.tsx).
installZodErrorMapPtBr();

// Polyfills used by Radix components in the jsdom environment
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const g = globalThis as unknown as { ResizeObserver?: unknown };
if (typeof g.ResizeObserver === 'undefined') {
  g.ResizeObserver = ResizeObserverPolyfill;
}

// jsdom does not implement scrollIntoView nor the PointerEvent helpers used by Radix Select.
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.scrollIntoView) {
    proto.scrollIntoView = function () {};
  }
  if (!proto.scrollTo) {
    proto.scrollTo = function () {};
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

// Clean up the DOM after each test
afterEach(() => {
  cleanup();
});
