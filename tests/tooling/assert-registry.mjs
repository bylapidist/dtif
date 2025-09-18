import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const schemaPath = path.join(repoRoot, 'schema/core.json');
const registryPath = path.join(repoRoot, 'registry/types.json');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectBuiltInTypes(schema) {
  const builtIn = new Set();
  const tokenSchema = schema?.$defs?.token;
  if (tokenSchema && Array.isArray(tokenSchema.allOf)) {
    for (const clause of tokenSchema.allOf) {
      const typeConst = clause?.if?.properties?.$type?.const;
      if (typeof typeConst === 'string') {
        builtIn.add(typeConst);
      }
    }
  }
  return builtIn;
}

export default function assertRegistry() {
  const errors = [];
  const schema = readJSON(schemaPath);
  const registry = readJSON(registryPath);
  const builtInTypes = collectBuiltInTypes(schema);

  const registryKeys = Object.keys(registry);
  const sortedKeys = [...registryKeys].sort((a, b) => a.localeCompare(b));
  for (let i = 0; i < registryKeys.length; i += 1) {
    if (registryKeys[i] !== sortedKeys[i]) {
      errors.push({
        code: 'E_REGISTRY_ORDER',
        path: '/registry/types.json',
        message: 'registry types must be sorted lexicographically'
      });
      break;
    }
  }

  for (const type of builtInTypes) {
    if (!Object.prototype.hasOwnProperty.call(registry, type)) {
      errors.push({
        code: 'E_REGISTRY_MISSING_TYPE',
        path: `/registry/types.json/${type}`,
        message: `registry missing entry for built-in type ${type}`
      });
    }
  }

  const vendorPattern = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;
  const contactPattern = /^(https:\/\/|mailto:)/;
  const specPattern = /^https:\/\//;

  for (const [type, entry] of Object.entries(registry)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push({
        code: 'E_REGISTRY_ENTRY_SHAPE',
        path: `/registry/types.json/${type}`,
        message: 'registry entry must be an object'
      });
      continue;
    }

    for (const field of ['vendor', 'owner', 'contact', 'spec']) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        errors.push({
          code: 'E_REGISTRY_FIELD_TYPE',
          path: `/registry/types.json/${type}/${field}`,
          message: `registry field ${field} must be a non-empty string`
        });
      }
    }

    if (typeof entry.vendor === 'string' && !vendorPattern.test(entry.vendor)) {
      errors.push({
        code: 'E_REGISTRY_VENDOR_FORMAT',
        path: `/registry/types.json/${type}/vendor`,
        message: 'vendor must be a lower-case reverse-DNS identifier'
      });
    }

    if (typeof entry.contact === 'string' && !contactPattern.test(entry.contact)) {
      errors.push({
        code: 'E_REGISTRY_CONTACT_FORMAT',
        path: `/registry/types.json/${type}/contact`,
        message: 'contact must be an https or mailto URL'
      });
    }

    if (typeof entry.spec === 'string' && !specPattern.test(entry.spec)) {
      errors.push({
        code: 'E_REGISTRY_SPEC_URL',
        path: `/registry/types.json/${type}/spec`,
        message: 'spec must be an https URL'
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
