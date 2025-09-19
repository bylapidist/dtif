import type { Options as AjvOptions, ValidateFunction, ErrorObject } from 'ajv';

export interface CreateDtifValidatorOptions {
  ajv?: import('ajv').default;
  ajvOptions?: AjvOptions;
  formats?: false | ((ajv: import('ajv').default) => unknown);
  schemaId?: string;
}

export interface DtifValidator {
  ajv: import('ajv').default;
  schema: typeof schema;
  schemaId: string;
  validate: ValidateFunction;
}

export interface DtifValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null | undefined;
}

export declare const schema: typeof import('@lapidist/dtif-schema/core.json');

export declare function createDtifValidator(options?: CreateDtifValidatorOptions): DtifValidator;

export declare function validateDtif(
  document: unknown,
  options?: CreateDtifValidatorOptions
): DtifValidationResult;
