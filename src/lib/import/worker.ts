/**
 * L'import tourne ici, hors du fil principal : décompresser un ZIP de plusieurs
 * centaines de mégaoctets et parcourir un XML ne doivent pas figer l'onglet.
 */

import { importFiles } from './index';

interface ProgressMessage {
  type: 'progress';
  message: string;
  progress?: number;
}

interface DoneMessage {
  type: 'done';
  result: unknown;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (value: unknown) => void;
};

function post(message: ProgressMessage | DoneMessage | ErrorMessage): void {
  scope.postMessage(message);
}

scope.onmessage = async (event: MessageEvent) => {
  const files = (event.data as { files?: File[] }).files;
  if (!files || files.length === 0) {
    post({ type: 'error', message: 'Aucun fichier reçu.' });
    return;
  }

  try {
    const result = await importFiles(files, {
      onStep: (message) => post({ type: 'progress', message }),
      onProgress: (progress) => post({ type: 'progress', message: '', progress }),
    });
    post({ type: 'done', result });
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Import impossible.',
    });
  }
};
