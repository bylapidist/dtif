export type ContextInput = ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;

export function toReadonlyContextMap(context?: ContextInput): ReadonlyMap<string, unknown> {
  if (!context) {
    return new Map();
  }

  if (context instanceof Map) {
    return context;
  }

  return new Map(Object.entries(context));
}
