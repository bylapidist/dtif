const TEMPORAL_CODE = 'E_METADATA_TEMPORAL_ORDER';
const USAGE_CODE = 'E_METADATA_USAGE_COUNT';

export default function assertMetadata(doc) {
  const errors = [];

  function walk(node, path = '') {
    if (Array.isArray(node)) {
      node.forEach((value, index) => walk(value, `${path}/${index}`));
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    const { $lastModified, $lastUsed, $usageCount } = node;
    const hasMetadata =
      $lastModified !== undefined || $lastUsed !== undefined || $usageCount !== undefined;

    if (hasMetadata) {
      const pointer = path || '';

      if (typeof $lastModified === 'string' && typeof $lastUsed === 'string') {
        const modifiedTime = Date.parse($lastModified);
        const usedTime = Date.parse($lastUsed);
        if (!Number.isNaN(modifiedTime) && !Number.isNaN(usedTime) && usedTime < modifiedTime) {
          errors.push({
            code: TEMPORAL_CODE,
            path: pointer,
            message: '$lastUsed must not precede $lastModified'
          });
        }
      }

      if ($lastUsed !== undefined) {
        if (typeof $usageCount !== 'number') {
          errors.push({
            code: USAGE_CODE,
            path: pointer,
            message: '$lastUsed requires $usageCount greater than zero'
          });
        } else if ($usageCount <= 0) {
          errors.push({
            code: USAGE_CODE,
            path: pointer,
            message: '$lastUsed requires $usageCount greater than zero'
          });
        }
      }

      if (typeof $usageCount === 'number' && $usageCount > 0 && $lastUsed === undefined) {
        errors.push({
          code: USAGE_CODE,
          path: pointer,
          message: '$usageCount greater than zero requires $lastUsed'
        });
      }
    }

    for (const [key, value] of Object.entries(node)) {
      walk(value, `${path}/${key}`);
    }
  }

  walk(doc);
  return { valid: errors.length === 0, errors };
}
