# Coverage Matrix (excerpt)

<!-- prettier-ignore -->
| Area | Positive fixtures | Negative fixtures |
| --- | --- | --- |
| Primitives & Units: numeric edges | `positive/primitives` | `negative/schema-violations` |
| Primitives & Units: dimension categories | `positive/dimension-categories` | `negative/dimension-unit-mismatch` |
| References: aliases vs broken pointers | `positive/aliases` | `negative/broken-refs`, `negative/cycles` |
| References: nested calc unresolved ref | - | `negative/broken-refs/nested-calc` |
| References: remote documents | `positive/remote-refs` | `negative/security/remote-disabled`, `negative/security/remote-scheme` |
| FunctionValue calc units | `positive/function-value` | `negative/unit-mismatch` |
| FunctionValue clamp range | `positive/function-value/clamp` | `negative/incompatible-types/clamp-min-greater-max` |
| FunctionValue alias parameters | `positive/function-value/alias` | `negative/function-parameter-invalid-alias`, `negative/function-parameter-type-mismatch` |
| Overrides type compatibility | `positive/overrides` | `negative/overrides-type-mismatch`, `negative/overrides-function-type-mismatch` |
| Overrides target validation | `positive/overrides` | `negative/overrides-target-missing-type`, `negative/overrides-target-collection` |
| Overrides cycle detection | `positive/overrides` | `negative/overrides-fallback-cycle` |
| FunctionValue gradients | `positive/gradients` | - |
| Duration tokens | `positive/duration` | `negative/duration-domain` |
| Easing functions | `positive/easing` | - (normative coverage via CSS Easing Functions) |
| Z-index tokens | `positive/z-index` | - |
| Font tokens | `positive/font` | `negative/font-weight-negative-font` |
| Font face tokens | `positive/font-face` | `negative/font-face-missing-src` |
| Motion tokens | `positive/motion` | `negative/motion-path-order`, `negative/motion-path-start-time`, `negative/motion-path-end-time`, `negative/motion-path-time-range`, `negative/motion-path-easing-type`, `negative/motion-rotation-origin-range` |
| Elevation tokens | `positive/elevation` | - |
| Shadow tokens | `positive/shadow`, `positive/shadow-fallback` | `negative/shadow-invalid-dimension`, `negative/shadow-layer-empty`, `negative/shadow-layer-missing-type` |
| Deprecation replacement metadata | `positive/deprecated-replacement` | `negative/deprecated-missing-replacement`, `negative/deprecated-invalid-replacement`, `negative/deprecated-replacement-target-missing` |
| Metadata hygiene & telemetry | `positive/metadata-complete` | `negative/author-leading-space`, `negative/tags-leading-space`, `negative/tags-duplicate`, `negative/hash-whitespace`, `negative/metadata-last-used-before-modified`, `negative/metadata-last-used-requires-usage-count`, `negative/metadata-usage-count-requires-last-used` |
| Change management: collection ordering | `positive/primitives` | `negative/collection-order` |
| Collections: metadata-only nodes | `positive/collection-metadata-only` | `negative/collection-type`, `negative/collection-ref` |
| Extensions: preserve unknown keys | `positive/extensions-preserve` | `negative/extensions-invalid-namespace`, `negative/extensions-missing-dot` |
| Unknown `$type` preservation | `positive/unknown-type-preserve` | - |
| Numeric precision | - | `negative/overflow-precision` |
| Security: remote ref schemes | - | `negative/security/remote-scheme` |
| Security: path traversal | - | `negative/security/path-traversal` |
| Versioning: `$version` field | `positive/version-semver-prerelease` | `negative/version-invalid-semver`, `negative/version-leading-zero`, `negative/version-pre-release-leading-zero` |
| Snapshots: CSS codegen | `snapshots/css/basic` | - |
| Snapshots: iOS codegen | `snapshots/ios/basic` | - |

This file will be expanded to cover all matrix cells as fixtures are added.

Additional automated checks ensure the type registry stays aligned with the schema:

- `tests/tooling/assert-registry.mjs` validates that every built-in `$type` has a populated, well-formed entry in `registry/types.json` and that the registry remains stably ordered for reproducible diffs.
