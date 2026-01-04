/**
 * Bridge between main thread and Rayforce WASM Worker
 */

import type { WorkerRequest, WorkerResponse } from '@core/model/types';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class RayforceWorkerBridge {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private requestId = 0;
  private initialized = false;

  async init(): Promise<{ version: string }> {
    if (this.initialized) {
      throw new Error('Already initialized');
    }

    // Create worker
    this.worker = new Worker(
      new URL('../../workers/rayforce.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Set up message handler
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);

    // Send init message and wait for ready
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 30000);

      const readyHandler = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'ready') {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', readyHandler);
          this.initialized = true;
          resolve({ version: event.data.version });
        } else if (event.data.type === 'error' && 'id' in event.data && event.data.id === 'init') {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', readyHandler);
          reject(new Error(event.data.message));
        }
      };

      this.worker?.addEventListener('message', readyHandler);
      this.send({ type: 'init' });
    });
  }

  async eval(expression: string): Promise<unknown> {
    const id = this.nextId();
    return this.request({ type: 'eval', id, expression });
  }

  async loadData(
    data: ArrayBuffer,
    format: 'rayforce' | 'csv' = 'csv'
  ): Promise<unknown> {
    const id = this.nextId();
    return this.request(
      { type: 'load_data', id, data, format },
      [data] // Transfer ownership
    );
  }

  async writeFile(path: string, content: string): Promise<unknown> {
    const id = this.nextId();
    return this.request({ type: 'write_file', id, path, content });
  }

  cancel(id: string): void {
    this.send({ type: 'cancel', id });
    const pending = this.pending.get(id);
    if (pending) {
      pending.reject(new Error('Cancelled'));
      this.pending.delete(id);
    }
  }

  terminate(): void {
    if (this.worker) {
      // Reject all pending requests
      for (const [id, pending] of this.pending) {
        pending.reject(new Error('Worker terminated'));
        this.pending.delete(id);
      }
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }

  private nextId(): string {
    return `req-${++this.requestId}`;
  }

  private send(message: WorkerRequest, transfer?: Transferable[]): void {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    if (transfer) {
      this.worker.postMessage(message, transfer);
    } else {
      this.worker.postMessage(message);
    }
  }

  private request(
    message: WorkerRequest & { id: string },
    transfer?: Transferable[]
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pending.set(message.id, { resolve, reject });
      this.send(message, transfer);
    });
  }

  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data;

    switch (response.type) {
      case 'ready':
        // Handled by init
        break;

      case 'result': {
        const pending = this.pending.get(response.id);
        if (pending) {
          pending.resolve(response.data);
          this.pending.delete(response.id);
        }
        break;
      }

      case 'columns': {
        const pending = this.pending.get(response.id);
        if (pending) {
          pending.resolve(response.columns);
          this.pending.delete(response.id);
        }
        break;
      }

      case 'progress': {
        // Progress updates can be handled by subscribers
        console.debug(`[Worker] Progress ${response.id}: ${response.progress * 100}%`);
        break;
      }

      case 'error': {
        const pending = this.pending.get(response.id);
        if (pending) {
          pending.reject(new Error(response.message));
          this.pending.delete(response.id);
        }
        break;
      }

      default:
        console.warn('[Worker] Unknown message type:', response);
    }
  }

  private handleError(error: ErrorEvent): void {
    console.error('[Worker] Error:', error);
    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      pending.reject(new Error(`Worker error: ${error.message}`));
      this.pending.delete(id);
    }
  }
}

// Singleton instance (optional pattern)
let bridge: RayforceWorkerBridge | null = null;

export function getRayforce(): RayforceWorkerBridge {
  if (!bridge) {
    bridge = new RayforceWorkerBridge();
  }
  return bridge;
}
