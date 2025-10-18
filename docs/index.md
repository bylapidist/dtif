---
layout: home
title: Design Token Interchange Format
titleTemplate: Standards for interoperable design tokens
description: >-
  The Design Token Interchange Format (DTIF) is a vendor-neutral JSON specification for
  sharing colour, typography, spacing, motion, and other design tokens between design
  tooling and code bases.
hero:
  name: DTIF
  text: Design tokens that travel well
  tagline: Align design systems and product delivery with a standards-based token format.
  actions:
    - theme: brand
      text: Get started
      link: /guides/getting-started
    - theme: alt
      text: Read the specification
      link: /spec/
    - theme: minimal
      text: View the schema
      link: https://dtif.lapidist.net/schema/core.json
features:
  - icon: 🔄
    title: Interoperable by design
    details: Express tokens once and exchange them between design tools and codebases
      with predictable structure and naming.
  - icon: ⚖️
    title: Governed evolution
    details: Follow a transparent governance model that balances innovation with
      backwards compatibility.
  - icon: 🧰
    title: Tooling ready
    details: Use tested examples, validation scripts, and registry metadata to ship
      automation with confidence.
---

<section class="home-section" aria-labelledby="why-dtif">

## Why teams choose DTIF {#why-dtif}

DTIF defines a common language for design tokens so product teams can ship consistent
experiences faster. The specification separates the data model from implementation
details, enabling design platforms, component libraries, and build tooling to exchange
colour, typography, spacing, motion, and more without loss of fidelity.

### Interoperable structure

- Normalised JSON schema captures token value, metadata, and relationships.
- Clear terminology and architecture make it easy to reason about token inheritance
  and overrides.
- Conformance requirements ensure tokens behave the same across tools and runtimes.

### Extensible taxonomy

- Core token types cover practical scenarios from typography to animation.
- Namespaced extensions allow experimentation while maintaining interoperability.
- The [registry](https://github.com/bylapidist/dtif/tree/main/registry) records approved `$type` identifiers and extensions to
  keep adoption aligned.

### Verified quality

- Schema-backed examples demonstrate real-world documents and edge cases.
- Reference tooling validates documents and serialisation logic during CI.
- Governance processes provide predictable change management and versioning.

</section>

<section class="home-section" aria-labelledby="tooling-assets">

## Build faster with ready-to-use assets {#tooling-assets}

Use the curated resources in this repository to streamline implementation and stay in
sync with the standard:

- **Core schema** – the canonical [JSON Schema](https://dtif.lapidist.net/schema/core.json) for validators and toolchains.
- **Reference examples** – schema-valid [token documents](https://github.com/bylapidist/dtif/tree/main/examples) designed for testing and education.
- **Registry** – approved [`$type` identifiers, extensions, and namespaces](https://github.com/bylapidist/dtif/tree/main/registry).
- **Conformance tests** – fixtures for verifying implementations and ensuring
  [compatibility](https://github.com/bylapidist/dtif/tree/main/tests).
- **Design Lint** – a [DTIF-native CLI](https://design-lint.lapidist.net) for linting
  component codebases and build pipelines.
- **DTIFx Toolkit** – a [workflow hub](https://dtifx.lapidist.net/) and [open-source suite](https://github.com/bylapidist/dtifx) for orchestrating DTIF tooling.

Each resource is maintained alongside the specification so updates ship together and
are easy to adopt.

</section>

<section class="home-section" aria-labelledby="governance">

## Governance you can trust {#governance}

DTIF is stewarded through transparent governance procedures that balance forward
momentum with long-term stability. The governance documentation covers proposal
workflow, change control, licensing, and decision-making criteria, giving teams the
assurance they need to plan roadmaps and de-risk adoption.

> “DTIF helps our organisation collaborate across design and engineering while keeping
> a single source of truth for tokens.” – Early adopter feedback

</section>

<section class="home-section" aria-labelledby="get-involved">

## Get involved {#get-involved}

Whether you are piloting DTIF or building products on top of it, we welcome
contributions:

- Share implementation learnings in the [guides](/guides/) and improve onboarding.
- Submit examples, fixtures, and tooling through pull requests.
- Propose registry additions or specification enhancements via the governance process.

Join us in shaping an interoperable future for design tokens.

</section>
