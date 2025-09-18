---
title: Platform guidance
description: Non-normative mapping notes for applying DTIF tokens to major ecosystems.
outline: [2, 3]
---

# Platform guidance {#platform-guidance}

This section is non-normative.

- Web: map tokens to CSS custom properties and honour CSS colour spaces.
- iOS: map dimensions to `pt` and colours to `UIColor` supporting sRGB
  and Display‑P3.
- Android: map dimensions to `dp`/`sp` and colours to ARGB integers.
- Design tools: ensure round‑tripping preserves units, colour spaces, and typographic
  metrics.

Conversion tools _SHOULD_ document rounding behaviour for fractional
pixels and unit precision.
