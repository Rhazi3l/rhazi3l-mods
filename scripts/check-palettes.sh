#!/usr/bin/env bash
# Each mod keeps its own copy of hooks/palette.ts (a plugin cannot import another's files), so the
# colours stay the same only while the copies do. This fails, naming each copy that has drifted.
set -euo pipefail
cd "$(dirname "$0")/.."
reference=mods/clean-view/hooks/palette.ts
status=0
for copy in mods/*/hooks/palette.ts; do
  cmp -s "$reference" "$copy" || { echo "differs from $reference: $copy"; status=1; }
done
[ "$status" -eq 0 ] && echo "All palette copies match."
exit "$status"
