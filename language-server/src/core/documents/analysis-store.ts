import type { Node as JsonNode } from 'jsonc-parser';
import type { Position } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { analyzeTextDocument } from './analyzer.js';
import {
  findPointerKeyAtPosition,
  findReferenceAtPosition,
  matchPointerInAnalysis,
  type PointerKeyMatch,
  type PointerMatch
} from './queries.js';
import type { DocumentAnalysis, DocumentReference, PointerMetadata } from './types.js';

export type DocumentAnalysisUpdateStatus = 'updated' | 'retained' | 'cleared' | 'failed';

export interface DocumentAnalysisUpdateResult {
  readonly ok: boolean;
  readonly status: DocumentAnalysisUpdateStatus;
  readonly analysis?: DocumentAnalysis;
  readonly error?: unknown;
}

export class DocumentAnalysisStore {
  #analyses = new Map<string, DocumentAnalysis>();

  update(document: TextDocument): DocumentAnalysisUpdateResult {
    const previous = this.#analyses.get(document.uri);
    const text = document.getText();
    const isEffectivelyEmpty = text.trim().length === 0;

    try {
      const analysis = analyzeTextDocument(document, text);
      if (analysis) {
        this.#analyses.set(document.uri, analysis);
        return {
          ok: true,
          status: 'updated',
          analysis
        } satisfies DocumentAnalysisUpdateResult;
      }

      if (previous && !isEffectivelyEmpty) {
        return {
          ok: true,
          status: 'retained',
          analysis: previous
        } satisfies DocumentAnalysisUpdateResult;
      }

      this.#analyses.delete(document.uri);
      return {
        ok: true,
        status: 'cleared'
      } satisfies DocumentAnalysisUpdateResult;
    } catch (error: unknown) {
      if (!previous) {
        this.#analyses.delete(document.uri);
      }
      return {
        ok: false,
        status: 'failed',
        analysis: previous,
        error
      } satisfies DocumentAnalysisUpdateResult;
    }
  }

  remove(uri: string): void {
    this.#analyses.delete(uri);
  }

  get(uri: string): DocumentAnalysis | undefined {
    return this.#analyses.get(uri);
  }

  entries(): IterableIterator<[string, DocumentAnalysis]> {
    return this.#analyses.entries();
  }

  findReference(uri: string, position: Position): DocumentReference | null {
    const analysis = this.#analyses.get(uri);
    if (!analysis) {
      return null;
    }
    return findReferenceAtPosition(analysis.references, position);
  }

  findPointerKey(uri: string, position: Position): PointerKeyMatch | null {
    const analysis = this.#analyses.get(uri);
    if (!analysis) {
      return null;
    }
    return findPointerKeyAtPosition(analysis.pointers, position);
  }

  matchPointer(uri: string, position: Position): PointerMatch | null {
    const analysis = this.#analyses.get(uri);
    if (!analysis) {
      return null;
    }
    return matchPointerInAnalysis(analysis, position);
  }

  getPointerMetadata(uri: string, pointer: string): PointerMetadata | undefined {
    return this.#analyses.get(uri)?.pointers.get(pointer);
  }

  getPointerNode(uri: string, pointer: string): JsonNode | undefined {
    return this.getPointerMetadata(uri, pointer)?.node;
  }

  getTypeValues(): readonly string[] {
    return this.collectValues((analysis) => analysis.typeValues);
  }

  getExtensionKeys(): readonly string[] {
    return this.collectValues((analysis) => analysis.extensionKeys);
  }

  getUnitValues(): readonly string[] {
    return this.collectValues((analysis) => analysis.unitValues);
  }

  *references(): IterableIterator<DocumentReference> {
    for (const analysis of this.#analyses.values()) {
      for (const reference of analysis.references) {
        yield reference;
      }
    }
  }

  private collectValues(selector: (analysis: DocumentAnalysis) => ReadonlySet<string>): string[] {
    const values = new Set<string>();
    for (const analysis of this.#analyses.values()) {
      for (const value of selector(analysis)) {
        values.add(value);
      }
    }
    return Array.from(values).sort();
  }
}
