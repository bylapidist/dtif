const SINGLE_LINE_INLINE_YAML_PATTERN = /^[^{}\[\]\r\n]+:\s+\S/u;

export function normalizeInlineYamlText(text: string): string {
  if (text.includes('\n')) {
    return text;
  }

  const trimmed = text.trimStart();
  if (!SINGLE_LINE_INLINE_YAML_PATTERN.test(trimmed)) {
    return text;
  }

  return text.replace(/ (?=[^{}\[\],\s][^{}\[\],:]*:\s)/gu, (match, offset, source) => {
    const previous = offset > 0 ? source[offset - 1] : '';
    if (previous === '{' || previous === '[' || previous === ',') {
      return match;
    }
    return '\n';
  });
}
