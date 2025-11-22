import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const OUTPUT_PATH = resolve('.changeset/status.json');

try {
  execFileSync('npx', ['changeset', 'status', '--since=origin/main', '--output', OUTPUT_PATH], {
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Failed to compute changeset status. Ensure `origin/main` is fetched.', error);
  process.exit(1);
}

try {
  const result = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  const releases = Array.isArray(result.releases) ? result.releases : [];
  const changesets = Array.isArray(result.changesets) ? result.changesets : [];

  if (releases.length > 0 && changesets.length === 0) {
    console.error(
      'Changesets are required: packages changed since origin/main but no release notes were found. Run `npm run changeset`.'
    );
    process.exit(1);
  }
} catch (error) {
  console.error('Unable to read Changesets status output.', error);
  process.exit(1);
} finally {
  rmSync(OUTPUT_PATH, { force: true });
}
