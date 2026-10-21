/** L'annulation d'un import, entre deux tranches de lecture. */

export function abortError(): DOMException {
  return new DOMException('Import annulé.', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}
