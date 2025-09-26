import packageJson from '../package.json' with { type: 'json' };

export interface PackageMetadata {
  readonly name: string;
  readonly version: string;
}

function createPackageMetadata(raw: unknown): PackageMetadata {
  if (typeof raw !== 'object' || raw === null) {
    throw new TypeError('package.json must export an object.');
  }

  const possibleName: unknown = Reflect.get(raw, 'name');
  const possibleVersion: unknown = Reflect.get(raw, 'version');

  if (typeof possibleName !== 'string') {
    throw new TypeError('package.json is missing a string "name" property.');
  }

  if (typeof possibleVersion !== 'string') {
    throw new TypeError('package.json is missing a string "version" property.');
  }

  return {
    name: possibleName,
    version: possibleVersion
  } satisfies PackageMetadata;
}

export const packageMetadata = createPackageMetadata(packageJson);

export const packageName = packageMetadata.name;
export const packageVersion = packageMetadata.version;
