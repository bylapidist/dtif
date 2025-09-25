import { compareDiagnosticSeverity, type DiagnosticSeverity } from './severity.js';
import type { Diagnostic } from '../types.js';

export class DiagnosticBag implements Iterable<Diagnostic> {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly counts: Record<DiagnosticSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0
  };

  constructor(initial?: Iterable<Diagnostic>) {
    if (initial) {
      this.addMany(initial);
    }
  }

  get size(): number {
    return this.diagnostics.length;
  }

  get isEmpty(): boolean {
    return this.size === 0;
  }

  hasSeverity(severity: DiagnosticSeverity): boolean {
    return this.counts[severity] > 0;
  }

  hasErrors(): boolean {
    return this.counts.error > 0;
  }

  get errorCount(): number {
    return this.counts.error;
  }

  get warningCount(): number {
    return this.counts.warning;
  }

  get infoCount(): number {
    return this.counts.info;
  }

  count(severity?: DiagnosticSeverity): number {
    if (!severity) {
      return this.size;
    }

    return this.counts[severity];
  }

  highestSeverity(): DiagnosticSeverity | undefined {
    let highest: DiagnosticSeverity | undefined;

    for (const diagnostic of this.diagnostics) {
      if (!highest || compareDiagnosticSeverity(diagnostic.severity, highest) < 0) {
        highest = diagnostic.severity;
        if (highest === 'error') {
          break;
        }
      }
    }

    return highest;
  }

  add(diagnostic: Diagnostic): this {
    const normalized = freezeDiagnostic(diagnostic);
    this.diagnostics.push(normalized);
    this.counts[normalized.severity]++;
    return this;
  }

  addMany(diagnostics: Iterable<Diagnostic>): this {
    for (const diagnostic of diagnostics) {
      this.add(diagnostic);
    }
    return this;
  }

  extend(other: DiagnosticBag | Iterable<Diagnostic>): this {
    if (other instanceof DiagnosticBag) {
      return this.addMany(other.diagnostics);
    }
    return this.addMany(other);
  }

  clear(): void {
    this.diagnostics.length = 0;
    this.counts.error = 0;
    this.counts.warning = 0;
    this.counts.info = 0;
  }

  toArray(): readonly Diagnostic[] {
    return this.diagnostics.slice();
  }

  [Symbol.iterator](): Iterator<Diagnostic> {
    return this.diagnostics[Symbol.iterator]();
  }

  forEach(callback: (diagnostic: Diagnostic, index: number) => void): void {
    this.diagnostics.forEach(callback);
  }

  filter(predicate: (diagnostic: Diagnostic, index: number) => boolean): Diagnostic[] {
    return this.diagnostics.filter(predicate);
  }

  toJSON(): readonly Diagnostic[] {
    return this.toArray();
  }
}

function freezeDiagnostic(diagnostic: Diagnostic): Diagnostic {
  const related = diagnostic.related?.map((info) => {
    const normalizedRelated = { ...info };
    Object.freeze(normalizedRelated);
    return normalizedRelated;
  });

  const normalized: Diagnostic = {
    ...diagnostic,
    related: related ? Object.freeze(related) : undefined
  };

  Object.freeze(normalized);

  return normalized;
}
