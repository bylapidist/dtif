import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assertRegistry from './assert-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const schemaPath = path.join(repoRoot, 'schema/core.json');

function getEncoding(arg) {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg && typeof arg === 'object' && 'encoding' in arg) {
    return arg.encoding;
  }
  return undefined;
}

export default function assertRegistrySchemaSyncRegression() {
  const errors = [];
  const originalReadFileSync = fs.readFileSync;
  const injectedType = 'com.example.injected-type';

  try {
    fs.readFileSync = (filePath, options) => {
      const resolvedPath = path.resolve(filePath);
      const encoding = getEncoding(options);
      if (resolvedPath === schemaPath && (encoding === 'utf8' || encoding === undefined)) {
        const original = originalReadFileSync.call(fs, filePath, options);
        const source = Buffer.isBuffer(original) ? original.toString('utf8') : original;
        const schema = JSON.parse(source);

        const tokenCore = schema?.$defs?.['token-core'];
        if (tokenCore && Array.isArray(tokenCore.allOf)) {
          tokenCore.allOf.push({
            if: {
              properties: {
                $type: {
                  const: injectedType
                }
              },
              required: ['$type'],
              type: 'object'
            },
            then: {
              properties: {
                $value: true
              },
              type: 'object'
            }
          });
        }

        const mutated = JSON.stringify(schema);
        return encoding === undefined ? Buffer.from(mutated, 'utf8') : mutated;
      }

      return originalReadFileSync.call(fs, filePath, options);
    };

    const result = assertRegistry();
    if (result.valid) {
      errors.push({
        code: 'E_EXPECTED_FAILURE',
        path: '',
        message:
          'registry validation passed despite schema introducing an unregistered built-in type'
      });
    } else {
      const missingTypeError = result.errors.find(
        (error) =>
          error.code === 'E_REGISTRY_MISSING_TYPE' &&
          error.path === `/registry/types.json/${injectedType}`
      );
      if (!missingTypeError) {
        errors.push({
          code: 'E_EXPECTED_ERROR',
          path: '',
          message: 'schema/registry mismatch did not report E_REGISTRY_MISSING_TYPE'
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
