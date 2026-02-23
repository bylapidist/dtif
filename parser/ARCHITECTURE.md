# Parser Architecture

## Layers

1. `src/domain/*`
- Pure contracts and data shapes (`models`, `ports`, `services`, `primitives`).
- Must not depend on application, adapters, resolver internals, or CLI.

2. `src/application/*`, `src/session.ts`, `src/tokens/parse-tokens.ts`
- Use-case orchestration and runtime composition.
- May depend on `domain`, `ast`, `graph`, `resolver`, and adapter contracts.

3. `src/adapters/*`, `src/io/*`
- Boundary adapters for loader, decoding, validation bridges, node integrations.
- Should adapt infrastructure to domain ports. Avoid embedding multi-stage orchestration.

4. `src/cli/*`
- Presentation and process interaction only.

5. `src/index.ts`
- Public package surface.

## Dependency Direction Rules

- Allowed: `application -> domain`, `adapters -> domain`, `cli -> application`.
- Avoid: `domain -> application/adapters/cli`.
- Avoid cyclic imports across `domain`, `resolver`, and `plugins`.
- Prefer direct type imports from leaf modules over barrel re-exports when breaking cycles.

## External Graph Resolution

- External document loading for resolver inputs is handled by `src/resolver/external-graph-provider.ts`.
- `ResolutionAdapter` composes a provider and should not own decode/normalize/graph traversal logic.

## Ownership Conventions

- `src/ast/*`, `src/graph/*`, `src/resolver/*`: token semantics and resolution behavior.
- `src/io/*`: document IO and decoding behavior.
- `src/application/*`, `src/session*`, `src/tokens/*`: orchestration, snapshots, and pipeline composition.
- `src/adapters/*`: boundary translation.
- `src/cli/*`: UX/output behavior.

## Testing Conventions

- Unit tests assert each stage contract in isolation.
- Integration tests cover full parse flows and adapter behavior.
- Changes that alter diagnostics should include explicit diagnostic assertions.
