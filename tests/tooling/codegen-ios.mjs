export default function codegenIOS(tokens) {
  const lines = ['struct Tokens {'];
  function camel(parts) {
    return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  }
  function walk(node, path = []) {
    if (node && typeof node === 'object') {
      if ('$value' in node && path.length) {
        let val = node.$value;
        if (val && typeof val === 'object') {
          if (typeof val.value !== 'undefined' && typeof val.unit !== 'undefined') {
            val = `${val.value}${val.unit}`;
          } else {
            val = JSON.stringify(val);
          }
        }
        lines.push(`  static let ${camel(path)} = "${val}"`);
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === '$value' || k === '$type') continue;
        walk(v, [...path, k]);
      }
    }
  }
  walk(tokens);
  lines.push('}');
  return lines.join('\n') + (lines.length ? '\n' : '');
}
