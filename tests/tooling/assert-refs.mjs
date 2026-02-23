export default function assertRefs(doc, opts = {}) {
  const errors = [];
  const { allowRemote = false } = opts;

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

  function resolve(node) {
    if (Array.isArray(node)) {
      return node.map(resolve);
    }
    if (node && typeof node === 'object') {
      if (node.$ref && !node.$token && typeof node.$ref === 'string' && node.$ref.startsWith('#')) {
        return resolvePointer(doc, node.$ref);
      }
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = resolve(v);
      }
      return out;
    }
    return node;
  }

  function walk(node, curPath = '') {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${curPath}/${i}`));
    } else if (node && typeof node === 'object') {
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
        walk(v, `${curPath}/${k}`);
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
