---
'@lapidist/dtif-parser': major
---

Rename the session `cache` option to `documentCache` and update token helpers to
forward document caches through the base session options. Update your
integrations to pass `documentCache` when supplying custom document caches.
