export default function codegenCSS(tokens) {
  const lines = [];
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
        lines.push(`--${path.join('-')}: ${val};`);
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === '$value' || k === '$type') continue;
        walk(v, [...path, k]);
      }
    }
  }
  walk(tokens);
  return lines.join('\n') + (lines.length ? '\n' : '');
}
