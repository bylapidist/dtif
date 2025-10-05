export function areByteArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) {
    return true;
  }

  if (a.byteLength !== b.byteLength) {
    return false;
  }

  for (let index = 0; index < a.byteLength; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}
