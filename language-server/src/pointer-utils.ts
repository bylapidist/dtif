export function normalizePointer(pointer: string): string | undefined {
  if (pointer === '#') {
    return '#';
  }

  if (pointer.startsWith('#/')) {
    return pointer;
  }

  if (pointer.startsWith('/')) {
    return `#${pointer}`;
  }

  if (pointer.startsWith('#')) {
    return pointer.length > 1 ? `#/${pointer.slice(1)}` : '#';
  }

  return undefined;
}

export function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

export function pointerToPath(pointer: string): (string | number)[] {
  if (pointer === '#') {
    return [];
  }

  const segments = pointer
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));

  return segments.map((segment) => {
    if (/^-?\d+$/u.test(segment)) {
      const index = Number.parseInt(segment, 10);
      if (Number.isSafeInteger(index)) {
        return index;
      }
    }
    return segment;
  });
}

export function pathToPointer(path: readonly (string | number)[]): string {
  if (path.length === 0) {
    return '#';
  }

  const segments = path.map((segment) =>
    typeof segment === 'number' ? segment.toString() : escapeJsonPointerSegment(segment)
  );

  return `#/${segments.join('/')}`;
}

export function parentPointer(pointer: string): string | undefined {
  if (pointer === '#') {
    return undefined;
  }

  const path = pointerToPath(pointer);
  if (path.length === 0) {
    return undefined;
  }

  path.pop();
  return pathToPointer(path);
}
