import '@testing-library/jest-dom';

// Mock worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  postMessage() {
    // Mock implementation
  }

  terminate() {
    // Mock implementation
  }

  addEventListener() {
    // Mock implementation
  }

  removeEventListener() {
    // Mock implementation
  }
}

// @ts-expect-error - Mocking Worker
globalThis.Worker = MockWorker;

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver;
