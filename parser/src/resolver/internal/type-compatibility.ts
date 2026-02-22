import { createDtifValidator } from '@lapidist/dtif-validator';

type TokenValidator = (value: unknown) => boolean;

const tokenValidator = createTokenValidator();

function createTokenValidator(): TokenValidator {
  const { ajv, schemaId } = createDtifValidator();
  const tokenSchemaRef = `${schemaId}#/$defs/token`;

  const existing = ajv.getSchema(tokenSchemaRef);
  if (existing) {
    return (value: unknown) => toSynchronousResult(existing(value));
  }

  const compiled = ajv.compile({ $ref: tokenSchemaRef });
  return (value: unknown) => toSynchronousResult(compiled(value));
}

export function isOverrideValueCompatible(type: string | undefined, value: unknown): boolean {
  if (!type) {
    return true;
  }

  return tokenValidator({
    $type: type,
    $value: value
  });
}

function toSynchronousResult(result: boolean | Promise<unknown>): boolean {
  return typeof result === 'boolean' ? result : false;
}
