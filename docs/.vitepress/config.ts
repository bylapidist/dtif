import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../../schema/core.json');
const schemaRequestPath = '/schema/core.json';

function readSchema() {
  return fs.readFileSync(schemaPath, 'utf8');
}

const schemaStaticPlugin = {
  name: 'dtif-schema-static',
  configureServer(server) {
    server.watcher.add(schemaPath);
    server.middlewares.use((req, res, next) => {
      if (!req.url) {
        next();
        return;
      }
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname !== schemaRequestPath) {
        next();
        return;
      }
      const method = req.method ?? 'GET';
      if (method !== 'GET' && method !== 'HEAD') {
        next();
        return;
      }
      try {
        const contents = readSchema();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', Buffer.byteLength(contents).toString());
        if (method === 'HEAD') {
          res.statusCode = 200;
          res.end();
          return;
        }
        res.end(contents);
      } catch (error) {
        res.statusCode = 500;
        res.end('');
      }
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: schemaRequestPath.slice(1),
      source: readSchema()
    });
  }
};

export default defineConfig({
  title: 'DTIF',
  description: 'Design Token Interchange Format (DTIF) specification, guides, and governance.',
  lastUpdated: true,
  cleanUrls: true,
  sitemap: { hostname: 'https://dtif.lapidist.net' },
  themeConfig: {
    logo: '/dtif-logo.svg',
    nav: [
      { text: 'Specification', link: '/spec/' },
      { text: 'Guides', link: '/guides/' },
      { text: 'Tooling built with DTIF', link: '/tooling/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Governance', link: '/governance/' },
      { text: 'Roadmap', link: '/roadmap/' }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/bylapidist/dtif' }],
    sidebar: {
      '/spec/': [
        {
          text: 'Specification',
          items: [
            { text: 'DTIF specification', link: '/spec/' },
            { text: 'Introduction', link: '/spec/introduction' },
            { text: 'Terminology', link: '/spec/terminology' },
            { text: 'Architecture and model', link: '/spec/architecture-model' },
            { text: 'Format and serialisation', link: '/spec/format-serialisation' },
            { text: 'Token types', link: '/spec/token-types' },
            { text: 'Typography', link: '/spec/typography' },
            { text: 'Theming and overrides', link: '/spec/theming-overrides' },
            { text: 'Metadata', link: '/spec/metadata' },
            { text: 'Extensibility', link: '/spec/extensibility' },
            { text: 'Conformance', link: '/spec/conformance' },
            {
              text: 'Security, privacy, and related considerations',
              link: '/spec/security-privacy'
            },
            { text: 'Normative references', link: '/spec/references' },
            { text: 'Change management', link: '/spec/changes' },
            { text: 'License', link: '/spec/license' }
          ]
        }
      ],
      '/guides/': [
        {
          text: 'Guides',
          items: [
            { text: 'Guides overview', link: '/guides/' },
            { text: 'Getting started', link: '/guides/getting-started' },
            { text: 'Migrating from the DTCG format', link: '/guides/migrating-from-dtcg' },
            { text: 'Tooling integration', link: '/guides/tooling' },
            { text: 'Platform guidance', link: '/guides/platform-guidance' },
            { text: 'Using the DTIF parser', link: '/guides/dtif-parser' }
          ]
        }
      ],
      '/tooling/': [
        {
          text: 'Tooling built with DTIF',
          items: [
            { text: 'Tooling overview', link: '/tooling/' },
            { text: 'Design Lint', link: '/tooling/design-lint' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [{ text: 'Examples overview', link: '/examples/' }]
        }
      ],
      '/governance/': [
        {
          text: 'Governance',
          items: [
            { text: 'Governance overview', link: '/governance/' },
            { text: 'Governance processes', link: '/governance/processes' },
            { text: 'Governance license', link: '/governance/license' }
          ]
        }
      ],
      '/roadmap/': [
        {
          text: 'Roadmap',
          items: [{ text: 'Roadmap overview', link: '/roadmap/' }]
        }
      ]
    },
    search: {
      provider: 'local'
    },
    editLink: {
      pattern: 'https://github.com/bylapidist/dtif/edit/main/docs/:path',
      text: 'Edit this page'
    },
    lastUpdatedText: 'Last updated',
    outline: [2, 3]
  },
  markdown: {
    headers: {
      level: [2, 3, 4]
    }
  },
  vite: {
    plugins: [schemaStaticPlugin]
  }
});
