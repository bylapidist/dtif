export function escapeInlineCode(value: string): string {
  return value.replace(/`/gu, '\\`');
}
