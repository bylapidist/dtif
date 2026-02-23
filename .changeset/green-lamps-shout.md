---
"@lapidist/dtif-validator": patch
---

Enforce additional DTIF semantic requirements in the validator by rejecting unsorted gradient stops, invalid motion path timelines (`start=0`, `end=1`, monotonic keyframe times), non-easing motion path easing references, and incompatible `dimension` function expressions (`calc` unit family mixing and `clamp` min/max inversion).
