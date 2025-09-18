function deepEqual(a, b) {
  if (a === b) return true;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

export default function assertRoundtrip(doc) {
  const errors = [];
  let roundtripped;
  try {
    roundtripped = JSON.parse(JSON.stringify(doc));
  } catch (err) {
    errors.push({ code: 'E_ROUNDTRIP_SERIALIZE', path: '', message: err.message });
    return { valid: false, errors };
  }
  if (!deepEqual(doc, roundtripped)) {
    errors.push({
      code: 'E_ROUNDTRIP_MISMATCH',
      path: '',
      message: 'document differs after JSON roundtrip'
    });
  }
  return { valid: errors.length === 0, errors };
}
