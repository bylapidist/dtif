export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const stack = error.stack ?? '';
    return stack ? `${error.message}\n${stack}` : error.message;
  }

  return String(error);
}
