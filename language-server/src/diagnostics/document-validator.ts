import { createDtifValidator, type DtifValidator } from '@lapidist/dtif-validator';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Diagnostic as LspDiagnostic } from 'vscode-languageserver/node.js';
import { parseDocument } from './parsing.js';
import { buildSchemaDiagnostics, buildValidatorFailureDiagnostic } from './schema-diagnostics.js';
import type { DocumentValidationContext } from './types.js';

export interface DocumentValidatorOptions {
  readonly validator?: DtifValidator;
}

export class DocumentValidator {
  #validator: DtifValidator;

  constructor(options: DocumentValidatorOptions = {}) {
    this.#validator = options.validator ?? createDtifValidator();
  }

  validate(document: TextDocument): LspDiagnostic[] {
    const parseResult = parseDocument(document);
    if (!parseResult.ok) {
      return parseResult.diagnostics;
    }

    const context: DocumentValidationContext = { document, tree: parseResult.tree };

    let valid = false;
    try {
      valid = this.#validator.validate(parseResult.value);
    } catch (error) {
      return [buildValidatorFailureDiagnostic(error, document)];
    }

    if (valid) {
      return [];
    }

    const errors = this.#validator.validate.errors ?? [];
    return buildSchemaDiagnostics({ errors, context });
  }
}
