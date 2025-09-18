export default function assertOrdering(doc) {
  const errors = [];

  function checkOrder(keys, expected, path) {
    let last = -1;
    for (const key of expected) {
      const idx = keys.indexOf(key);
      if (idx === -1) return true; // missing keys aren't validated here
      if (idx < last) {
        errors.push({ code: 'E_ORDERING', path, message: 'canonical key order violated' });
        return false;
      }
      last = idx;
    }
    return true;
  }

  function checkCollectionOrder(node, path) {
    const entries = Object.entries(node).filter(([key]) => !key.startsWith('$'));
    if (entries.length < 2) {
      return;
    }
    const objectEntries = entries.filter(([, value]) => value && typeof value === 'object');
    if (objectEntries.length < 2) {
      return;
    }
    const keys = objectEntries.map(([key]) => key);
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < keys.length; i += 1) {
      if (keys[i] !== sorted[i]) {
        errors.push({
          code: 'E_COLLECTION_ORDER',
          path,
          message: 'collection members must be sorted lexicographically'
        });
        break;
      }
    }
  }

  function walk(node, path = '') {
    if (Array.isArray(node)) {
      node.forEach((val, idx) => walk(val, `${path}/${idx}`));
      return;
    }

    if (node && typeof node === 'object') {
      const keys = Object.keys(node);

      if ('$type' in node && '$value' in node) {
        checkOrder(keys, ['$type', '$value'], path);
      }

      if ('dimensionType' in node && 'value' in node && 'unit' in node) {
        checkOrder(keys, ['dimensionType', 'value', 'unit'], path);
      }

      if ('fn' in node && 'parameters' in node) {
        checkOrder(keys, ['fn', 'parameters'], path);
      }

      if ('colorSpace' in node && 'components' in node) {
        checkOrder(keys, ['colorSpace', 'components'], path);
      }

      checkCollectionOrder(node, path);

      for (const [k, v] of Object.entries(node)) {
        walk(v, `${path}/${k}`);
      }
    }
  }

  walk(doc);
  return { valid: errors.length === 0, errors };
}
