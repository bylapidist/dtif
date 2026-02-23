export default function assertRefs(doc, opts = {}) {
  const errors = [];
  const { allowRemote = false, allowExternal = false } = opts;
  const TYPOGRAPHY_KNOWN_VALUE_KEYS = new Set([
    'typographyType',
    'fontFamily',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'fontWeight',
    'fontStyle',
    'fontVariant',
    'fontStretch',
    'textDecoration',
    'textTransform',
    'color',
    'fontFeatures',
    'underlineThickness',
    'underlineOffset',
    'overlineThickness',
    'overlineOffset'
  ]);

  function resolvePointer(root, pointer, chain = [], refPath = '') {
    if (typeof pointer !== 'string') {
      errors.push({
        code: 'E_REF_INVALID_TYPE',
        path: refPath,
        message: 'ref pointer must be a string'
      });
      return null;
    }
    const hashIndex = pointer.indexOf('#');
    const beforeFragment = hashIndex === -1 ? pointer : pointer.slice(0, hashIndex);
    const [pathBeforeQuery] = beforeFragment.split('?');
    const normalisedPath = pathBeforeQuery
      .replace(/%2f/gi, '/')
      .replace(/%5c/gi, '\\')
      .replace(/%2e/gi, '.');
    const hasTraversal = normalisedPath
      .split(/[\\/]/)
      .filter((segment) => segment.length > 0)
      .some((segment) => segment === '..');
    if (hasTraversal) {
      errors.push({
        code: 'E_REF_PATH_TRAVERSAL',
        path: refPath,
        message: `path traversal not allowed: ${pointer}`
      });
      return null;
    }
    if (!pointer.startsWith('#')) {
      const hashIndex = pointer.indexOf('#');
      const base = hashIndex === -1 ? pointer : pointer.slice(0, hashIndex);
      if (base.startsWith('//') || base.startsWith('\\\\')) {
        errors.push({
          code: 'E_REF_NETWORK_PATH',
          path: refPath,
          message: `network-path refs are not allowed: ${pointer}`
        });
        return null;
      }

      if (base.startsWith('/') || base.startsWith('\\')) {
        errors.push({
          code: 'E_REF_ABSOLUTE_PATH',
          path: refPath,
          message: `absolute-path refs are not allowed: ${pointer}`
        });
        return null;
      }

      const schemeMatch = base.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);

      if (!schemeMatch) {
        if (!allowExternal) {
          errors.push({
            code: 'E_REF_EXTERNAL_UNRESOLVED',
            path: refPath,
            message: `external refs require explicit opt-in: ${pointer}`
          });
        }
        return null;
      }

      const scheme = schemeMatch[1].toLowerCase();
      if (!['http', 'https'].includes(scheme)) {
        errors.push({
          code: 'E_REF_UNSUPPORTED_SCHEME',
          path: refPath,
          message: `unsupported remote scheme ${pointer}`
        });
        return null;
      }

      if (!allowRemote) {
        errors.push({
          code: 'E_REF_REMOTE_DISABLED',
          path: refPath,
          message: `remote refs not allowed: ${pointer}`
        });
        return null;
      }

      if (!allowExternal) {
        errors.push({
          code: 'E_REF_EXTERNAL_UNRESOLVED',
          path: refPath,
          message: `external refs require explicit opt-in: ${pointer}`
        });
        return null;
      }
      try {
        const url = new URL(pointer);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push({
            code: 'E_REF_UNSUPPORTED_SCHEME',
            path: refPath,
            message: `unsupported remote scheme ${pointer}`
          });
        }
      } catch {
        errors.push({
          code: 'E_REF_INVALID_REMOTE',
          path: refPath,
          message: `invalid remote ref ${pointer}`
        });
      }

      return null;
    }
    if (chain.includes(pointer)) {
      errors.push({
        code: 'E_REF_CIRCULAR',
        path: refPath,
        message: `circular reference ${[...chain, pointer].join(' -> ')}`
      });
      return null;
    }
    const parts = pointer
      .slice(1)
      .split('/')
      .filter(Boolean)
      .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
    let cur = root;
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) {
        cur = cur[part];
      } else {
        errors.push({
          code: 'E_REF_UNRESOLVED',
          path: refPath,
          message: `unresolved pointer ${pointer}`
        });
        return null;
      }
    }
    if (cur && typeof cur === 'object' && cur.$ref) {
      return resolvePointer(root, cur.$ref, [...chain, pointer], refPath);
    }
    return cur;
  }

  function resolve(node, path = '', context = {}) {
    if (path.includes('/$extensions/')) {
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((entry, index) => resolve(entry, `${path}/${index}`, context));
    }
    if (node && typeof node === 'object') {
      if (node.$ref && !node.$token && typeof node.$ref === 'string' && node.$ref.startsWith('#')) {
        return resolvePointer(doc, node.$ref);
      }
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === '$extensions') {
          out[k] = v;
          continue;
        }
        if (
          context.inTypographyValue === true &&
          !TYPOGRAPHY_KNOWN_VALUE_KEYS.has(k) &&
          !k.startsWith('$')
        ) {
          out[k] = v;
          continue;
        }
        out[k] = resolve(v, `${path}/${k}`, {
          inTypographyValue:
            node.$type === 'typography' &&
            k === '$value' &&
            v &&
            typeof v === 'object' &&
            !Array.isArray(v)
        });
      }
      return out;
    }
    return node;
  }

  function walk(node, curPath = '', context = {}) {
    if (curPath.includes('/$extensions/')) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${curPath}/${i}`, context));
    } else if (node && typeof node === 'object') {
      const isOverrideEntry = /^\/\$overrides\/\d+$/.test(curPath);
      if (isOverrideEntry) {
        const hasRef = Object.prototype.hasOwnProperty.call(node, '$ref');
        const hasValue = Object.prototype.hasOwnProperty.call(node, '$value');
        const hasFallback = Object.prototype.hasOwnProperty.call(node, '$fallback');
        if ((!hasRef && !hasValue && !hasFallback) || (hasRef && hasValue)) {
          return;
        }
      }

      if (node.$ref) {
        resolvePointer(doc, node.$ref, [], `${curPath}/$ref`);
      }
      if (node.$token) {
        resolvePointer(doc, node.$token, [], `${curPath}/$token`);
      }
      if (
        node.$deprecated &&
        typeof node.$deprecated === 'object' &&
        node.$deprecated.$replacement
      ) {
        resolvePointer(
          doc,
          node.$deprecated.$replacement,
          [],
          `${curPath}/$deprecated/$replacement`
        );
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === '$extensions') {
          continue;
        }
        if (
          context.inTypographyValue === true &&
          !TYPOGRAPHY_KNOWN_VALUE_KEYS.has(k) &&
          !k.startsWith('$')
        ) {
          continue;
        }
        walk(v, `${curPath}/${k}`, {
          inTypographyValue:
            node.$type === 'typography' &&
            k === '$value' &&
            v &&
            typeof v === 'object' &&
            !Array.isArray(v)
        });
      }
    }
  }

  function collectOverrideGraph(root) {
    const graph = new Map();
    const tokenIndex = new Map();
    if (!Array.isArray(root?.$overrides)) {
      return { graph, tokenIndex };
    }

    root.$overrides.forEach((override, idx) => {
      if (!override || typeof override !== 'object') {
        return;
      }
      const hasRef = Object.prototype.hasOwnProperty.call(override, '$ref');
      const hasValue = Object.prototype.hasOwnProperty.call(override, '$value');
      const hasFallback = Object.prototype.hasOwnProperty.call(override, '$fallback');
      if ((!hasRef && !hasValue && !hasFallback) || (hasRef && hasValue)) {
        return;
      }
      const token = override.$token;
      if (typeof token !== 'string') {
        return;
      }

      if (!tokenIndex.has(token)) {
        tokenIndex.set(token, idx);
      }

      const addEdge = (ref) => {
        if (typeof ref !== 'string' || !ref.startsWith('#')) {
          return;
        }
        if (!graph.has(token)) {
          graph.set(token, new Set());
        }
        graph.get(token).add(ref);
      };

      const walkFallback = (entry) => {
        if (Array.isArray(entry)) {
          entry.forEach((value) => walkFallback(value));
          return;
        }
        if (!entry || typeof entry !== 'object') {
          return;
        }
        if (typeof entry.$ref === 'string') {
          addEdge(entry.$ref);
        }
        if (Object.prototype.hasOwnProperty.call(entry, '$fallback')) {
          walkFallback(entry.$fallback);
        }
      };

      if (typeof override.$ref === 'string') {
        addEdge(override.$ref);
      }
      if (Object.prototype.hasOwnProperty.call(override, '$fallback')) {
        walkFallback(override.$fallback);
      }
    });

    return { graph, tokenIndex };
  }

  function detectOverrideCycles(root) {
    const { graph, tokenIndex } = collectOverrideGraph(root);
    if (graph.size === 0) {
      return;
    }

    const visited = new Set();
    const stack = [];
    const inStack = new Set();
    const reported = new Set();

    const dfs = (node) => {
      stack.push(node);
      inStack.add(node);

      const targets = graph.get(node);
      if (targets) {
        for (const ref of targets) {
          if (!graph.has(ref)) {
            continue;
          }
          if (inStack.has(ref)) {
            const startIndex = stack.indexOf(ref);
            const cycle = stack.slice(startIndex);
            cycle.push(ref);
            const signature = cycle.join('->');
            if (!reported.has(signature)) {
              reported.add(signature);
              const first = cycle[0];
              const overrideIndex = tokenIndex.get(first);
              errors.push({
                code: 'E_OVERRIDE_CIRCULAR',
                path:
                  typeof overrideIndex === 'number'
                    ? `/$overrides/${overrideIndex}/$token`
                    : '/$overrides',
                message: `override cycle ${cycle.join(' -> ')}`
              });
            }
          } else if (!visited.has(ref)) {
            dfs(ref);
          }
        }
      }

      stack.pop();
      inStack.delete(node);
      visited.add(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
  }

  walk(doc);
  detectOverrideCycles(doc);
  const resolved = resolve(doc);
  return { valid: errors.length === 0, errors, resolved };
}
