import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assertRegistry from './assert-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const registryPath = path.join(repoRoot, 'registry/types.json');

function getEncoding(arg) {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg && typeof arg === 'object' && 'encoding' in arg) {
    return arg.encoding;
  }
  return undefined;
}

export default function assertRegistryHttpsRegression() {
  const errors = [];
  const originalReadFileSync = fs.readFileSync;
  let mutatedKey;

  try {
    fs.readFileSync = (filePath, options) => {
      const resolvedPath = path.resolve(filePath);
      const encoding = getEncoding(options);
      if (resolvedPath === registryPath && (encoding === 'utf8' || encoding === undefined)) {
        const original = originalReadFileSync.call(fs, filePath, options);
        const source = Buffer.isBuffer(original) ? original.toString('utf8') : original;
        const registry = JSON.parse(source);
        const keys = Object.keys(registry);
        mutatedKey = keys[0];
        const entry = registry[mutatedKey] || {};
        const originalSpec = entry.spec;
        let mutatedSpec;
        if (typeof originalSpec === 'string' && originalSpec.startsWith('https://')) {
          mutatedSpec = `http://${originalSpec.slice('https://'.length)}`;
        } else {
          mutatedSpec = 'http://example.com/spec';
        }
        registry[mutatedKey] = { ...entry, spec: mutatedSpec };
        const mutatedJSON = JSON.stringify(registry);
        return encoding === undefined ? Buffer.from(mutatedJSON, 'utf8') : mutatedJSON;
      }

      return originalReadFileSync.call(fs, filePath, options);
    };

    const result = assertRegistry();
    if (result.valid) {
      errors.push({
        code: 'E_EXPECTED_FAILURE',
        path: '',
        message: 'registry validation passed for http spec URL'
      });
    } else {
      const expectedPath = mutatedKey ? `/registry/types.json/${mutatedKey}/spec` : undefined;
      const specError = result.errors.find(
        (error) =>
          error.code === 'E_REGISTRY_SPEC_URL' && (!expectedPath || error.path === expectedPath)
      );
      if (!specError) {
        errors.push({
          code: 'E_EXPECTED_ERROR',
          path: '',
          message: 'http spec URL did not report E_REGISTRY_SPEC_URL'
        });
      }
    }
  } catch (error) {
    errors.push({
      code: 'E_UNEXPECTED_EXCEPTION',
      path: '',
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    fs.readFileSync = originalReadFileSync;
  }

  return { valid: errors.length === 0, errors };
}
