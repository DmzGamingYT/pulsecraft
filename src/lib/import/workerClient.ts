/**
 * Le pont vers le Web Worker d'import, avec repli synchrone.
 *
 * Si le navigateur refuse le worker (WebView ancienne, extension qui bloque
 * les modules), on importe sur le fil principal : plus lent, mais jamais cassé.
 */

import type { ParsedImport } from '../../types';
import { importFiles, type ImportOptions } from './index';

interface WorkerProgress {
  type: 'progress';
  message: string;
  progress?: number;
}
interface WorkerDone {
  type: 'done';
  result: ParsedImport[];
}
interface WorkerError {
  type: 'error';
  message: string;
}

export async function importInWorker(files: File[], options: ImportOptions = {}): Promise<ParsedImport[]> {
  if (options.signal?.aborted) throw new DOMException('Import annulé.', 'AbortError');
  if (typeof Worker === 'undefined') return importFiles(files, options);

  let worker: Worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return importFiles(files, options);
  }

  return new Promise<ParsedImport[]>((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Import annulé.', 'AbortError'));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<WorkerProgress | WorkerDone | WorkerError>) => {
      const data = event.data;
      if (data.type === 'progress') {
        if (data.message) options.onStep?.(data.message);
        if (typeof data.progress === 'number') options.onProgress?.(data.progress);
        return;
      }
      cleanup();
      if (data.type === 'done') resolve(data.result);
      else reject(new Error(data.message));
    };

    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'Le worker d’import a échoué.'));
    };

    worker.postMessage({ files });
  });
}
