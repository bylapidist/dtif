import type { JsonPointer } from '../../domain/primitives.js';

export function createResolutionKey(uri: URL, pointer: JsonPointer): string {
  return `${uri.href}#${pointer}`;
}
