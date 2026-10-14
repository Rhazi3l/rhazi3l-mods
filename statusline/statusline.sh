#!/usr/bin/env bash
# rhazi3l-mods status line: plan, model, effort, context bar and rate limits on
# one row under the prompt, in the colours of the active Claude Code theme
# (~/.claude/themes/omarchy.json, written by omarchy-theme-set-claude).
#
# Claude Code runs this with the session's figures as JSON on stdin and draws
# the first line it prints. Set in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "~/Work/rhazi3l-mods/statusline/statusline.sh", "padding": 0 }

set -uo pipefail

input=$(cat)
theme="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/themes/omarchy.json"

# Theme colours as "r;g;b", read in one jq pass, falling back to the Rhazi3l palette.
rgb() {
  local hex=${1#\#}
  printf '%d;%d;%d' "0x${hex:0:2}" "0x${hex:2:2}" "0x${hex:4:2}"
}
mapfile -t hexes < <(
  jq -r '.overrides as $o | ["claude", "text", "inactive", "subtle", "success", "warning", "error", "permission", "suggestion"]
    | .[] | $o[.] // ""' "$theme" 2>/dev/null
)
ACCENT=$(rgb "${hexes[0]:-#d4743c}")
TEXT=$(rgb "${hexes[1]:-#b4bbc7}")
DIM=$(rgb "${hexes[2]:-#757a83}")
SUBTLE=$(rgb "${hexes[3]:-#444b58}")
GREEN=$(rgb "${hexes[4]:-#a3be8c}")
AMBER=$(rgb "${hexes[5]:-#ebcb8b}")
RED=$(rgb "${hexes[6]:-#d9707a}")
BLUE=$(rgb "${hexes[7]:-#81a1c1}")
CYAN=$(rgb "${hexes[8]:-#88c0d0}")

fg() { printf '\033[38;2;%sm' "$1"; }
BOLD=$'\033[1m'
RESET=$'\033[0m'
SEP=" $(fg "$SUBTLE")│$RESET "

# One jq pass for every field, split on the unit separator (a tab would
# collapse empty fields when read).
IFS=$'\x1f' read -r model effort ctx five five_at week week_at cost has_limits < <(
  jq -r '[
    (.model.display_name // .model.id // "Claude"),
    (.effort.level // ""),
    (.context_window.used_percentage // ""),
    (.rate_limits.five_hour.used_percentage // ""),
    (.rate_limits.five_hour.resets_at // ""),
    (.rate_limits.seven_day.used_percentage // ""),
    (.rate_limits.seven_day.resets_at // ""),
    (.cost.total_cost_usd // ""),
    (if .rate_limits then "yes" else "" end)
  ] | map(tostring) | join("\u001f")' <<<"$input"
)

# The colour a usage figure is drawn in: accent, amber from 80%, red from 95%.
level() {
  local pct=${1%.*}
  if ((pct >= 95)); then echo "$RED"; elif ((pct >= 80)); then echo "$AMBER"; else echo "$ACCENT"; fi
}

# A 10-cell bar, any use showing at least one cell.
bar() {
  local pct=${1%.*} cells i filled="" empty=""
  ((pct > 100)) && pct=100
  cells=$(((pct * 10 + 50) / 100))
  ((pct > 0 && cells == 0)) && cells=1
  for ((i = 0; i < 10; i++)); do
    if ((i < cells)); then filled+='▰'; else empty+='▱'; fi
  done
  printf '%s%s%s%s%s' "$(fg "$(level "$pct")")" "$filled" "$(fg "$SUBTLE")" "$empty" "$RESET"
}

# Seconds until an epoch time as "2h 10m" or "3d 4h".
until_time() {
  local left=$(($1 - EPOCHSECONDS))
  ((left < 0)) && left=0
  local m=$((left / 60)) h=$((left / 3600)) d=$((left / 86400))
  if ((d > 0)); then printf '%dd %dh' "$d" $((h % 24))
  elif ((h > 0)); then printf '%dh %dm' "$h" $((m % 60))
  else printf '%dm' "$m"; fi
}

parts=()
if [[ -n $has_limits ]]; then
  parts+=("$(fg "$GREEN")◆$RESET $(fg "$TEXT")Subscription$RESET")
else
  parts+=("$(fg "$CYAN")◆$RESET $(fg "$TEXT")API$RESET")
fi
parts+=("$(fg "$BLUE")◆$RESET $BOLD$(fg "$TEXT")$model$RESET")
[[ -n $effort ]] && parts+=("$(fg "$DIM")effort$RESET $BOLD$(fg "$CYAN")$effort$RESET")
if [[ -n $ctx ]]; then
  parts+=("$(fg "$DIM")ctx$RESET $(bar "$ctx") $BOLD$(fg "$(level "$ctx")")${ctx%.*}%$RESET")
fi
if [[ -n $five ]]; then
  reset=""
  [[ -n $five_at ]] && reset=" $(fg "$DIM")↻ $(until_time "${five_at%.*}")$RESET"
  parts+=("$(fg "$DIM")5h$RESET $BOLD$(fg "$(level "$five")")${five%.*}%$RESET$reset")
fi
if [[ -n $week ]]; then
  reset=""
  [[ -n $week_at ]] && reset=" $(fg "$DIM")↻ $(until_time "${week_at%.*}")$RESET"
  parts+=("$(fg "$DIM")week$RESET $BOLD$(fg "$(level "$week")")${week%.*}%$RESET$reset")
fi
# Cost only means money on the API; a subscription's figure is notional.
if [[ -z $has_limits && -n $cost ]]; then
  parts+=("$(fg "$DIM")cost$RESET $(fg "$TEXT")\$$(printf '%.2f' "$cost")$RESET")
fi

line=""
for part in "${parts[@]}"; do
  [[ -n $line ]] && line+=$SEP
  line+=$part
done
printf '%s\n' "$line"
