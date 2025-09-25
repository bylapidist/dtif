const SINGLE_LINE_INLINE_YAML_PATTERN = /^[^{}\[\]\r\n]+:\s+\S/u;

export function isSingleLineInlineYaml(text: string): boolean {
  return SINGLE_LINE_INLINE_YAML_PATTERN.test(text);
}

export function normalizeInlineYamlText(text: string): string {
  if (text.includes('\n')) {
    return text;
  }

  const trimmed = text.trimStart();
  if (!isSingleLineInlineYaml(trimmed)) {
    return text;
  }

  return text.replace(/ (?=[^{}\[\],\s][^{}\[\],:]*:\s)/gu, (match: string, offset: number, source: string) => {
    const previous = offset > 0 ? source.charAt(offset - 1) : '';
    if (previous === '{' || previous === '[' || previous === ',') {
      return match;
    }
    return '\n';
  });
}
