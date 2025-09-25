export const DIAGNOSTIC_SEVERITIES = ['error', 'warning', 'info'] as const;

export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];

const SEVERITY_TO_WEIGHT: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2
};

const SEVERITY_SET: ReadonlySet<string> = new Set(DIAGNOSTIC_SEVERITIES);

export function isDiagnosticSeverity(value: unknown): value is DiagnosticSeverity {
  return typeof value === 'string' && SEVERITY_SET.has(value);
}

export function compareDiagnosticSeverity(a: DiagnosticSeverity, b: DiagnosticSeverity): number {
  return SEVERITY_TO_WEIGHT[a] - SEVERITY_TO_WEIGHT[b];
}

export function maxDiagnosticSeverity(
  ...severities: readonly DiagnosticSeverity[]
): DiagnosticSeverity | undefined {
  let max: DiagnosticSeverity | undefined;

  for (const severity of severities) {
    if (!max || compareDiagnosticSeverity(severity, max) < 0) {
      max = severity;
    }
  }

  return max;
}

export function minDiagnosticSeverity(
  ...severities: readonly DiagnosticSeverity[]
): DiagnosticSeverity | undefined {
  let min: DiagnosticSeverity | undefined;

  for (const severity of severities) {
    if (!min || compareDiagnosticSeverity(severity, min) > 0) {
      min = severity;
    }
  }

  return min;
}

export function severityWeight(severity: DiagnosticSeverity): number {
  return SEVERITY_TO_WEIGHT[severity];
}
