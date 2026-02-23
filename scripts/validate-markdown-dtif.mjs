import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { validateDtif } from '../validator/index.js';

const execFile = promisify(execFileCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const { stdout } = await execFile('git', ['ls-files', 'README.md', 'docs/**/*.md'], {
  cwd: repoRoot
});

const files = stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((relativePath) => path.join(repoRoot, relativePath));

const codeFencePattern = /```([^\n]*)\n([\s\S]*?)```/g;

const failures = [];
const successes = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  let match;
  let index = 0;
  while ((match = codeFencePattern.exec(text)) !== null) {
    index += 1;
    const [, infoStringRaw, rawContent] = match;
    const infoString = infoStringRaw.trim();
    const infoTokens = infoString.split(/\s+/).filter(Boolean);
    const hasDtifTag = infoTokens.includes('dtif');
    if (!hasDtifTag) {
      continue;
    }

    const cleaned = rawContent
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      failures.push({
        file,
        index,
        errors: [{ instancePath: '<parse>', message: `Failed to parse JSON: ${error.message}` }]
      });
      continue;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      failures.push({
        file,
        index,
        errors: [{ instancePath: '<root>', message: 'DTIF example must be a JSON object' }]
      });
      continue;
    }

    const result = validateDtif(parsed, { enforceSemanticRules: false });
    if (!result.valid) {
      failures.push({ file, index, errors: result.errors });
    } else {
      successes.push({ file, index });
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    const relativePath = path.relative(repoRoot, failure.file);
    console.error(`Validation failed for ${relativePath} (code block #${failure.index}):`);
    for (const error of failure.errors ?? []) {
      console.error(`  [${error.instancePath || '<root>'}] ${error.message}`);
    }
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${successes.length} DTIF example(s).`);
}
