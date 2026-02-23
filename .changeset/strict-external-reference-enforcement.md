---
"@lapidist/dtif-parser": patch
"@lapidist/dtif-validator": patch
---

Enforce stricter DTIF reference conformance by rejecting unresolved external references during validation unless explicit opt-in is provided. This update adds validator checks for unresolved relative and remote external refs by default, wires parser defaults to opt in to external-reference validation deferral when a loader is available, and adds regression coverage in conformance tooling.
