#!/usr/bin/env bash
# Claude Code status line: plan, model, effort, context bar and rate limits on
# one row under the prompt, in the same colours as the rhazi3l mods
# (the theme's orange accent, then green, yellow, red, blue, cyan). Plain text, dim labels and the
# unlit bar cells still follow the active theme (~/.claude/themes/omarchy.json,
# written by omarchy-theme-set-claude).
#
# Claude Code runs this with the session's figures as JSON on stdin and draws
# the first line it prints. Set in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "~/.claude/statusline.sh", "padding": 0 }

set -uo pipefail

input=$(cat)
NOW=$(date +%s)
theme="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/themes/omarchy.json"

# Colours as "r;g;b". The text and dim greys come from the theme in one jq pass,
# falling back to the Rhazi3l palette.
rgb() {
  local hex=${1#\#}
  printf '%d;%d;%d' "0x${hex:0:2}" "0x${hex:2:2}" "0x${hex:4:2}"
}
hexes=()
while IFS= read -r hex; do hexes+=("$hex"); done < <(
  jq -r '.overrides as $o | ["text", "inactive", "subtle"]
    | .[] | $o[.] // ""' "$theme" 2>/dev/null
)
TEXT=$(rgb "${hexes[0]:-#b4bbc7}")
DIM=$(rgb "${hexes[1]:-#757a83}")
SUBTLE=$(rgb "${hexes[2]:-#444b58}")
# The mods' colours (mods/*/hooks/palette.ts): the theme's orange, the rest softer than the
# theme but clearly separate; cyan is picked the same way, for the effort value.
ACCENT=$(rgb "#d4743c")
GREEN=$(rgb "#9dcb86")
AMBER=$(rgb "#f1ce7e")
RED=$(rgb "#e67a85")
BLUE=$(rgb "#73a5de")
CYAN=$(rgb "#85c9d6")

fg() { printf '\033[38;2;%sm' "$1"; }
BOLD=$'\033[1m'
RESET=$'\033[0m'
SEP=" $(fg "$SUBTLE")│$RESET "

# One jq pass for every field, split on the unit separator (a tab would
# collapse empty fields when read).
IFS=$'\x1f' read -r model model_id transcript effort ctx five five_at week week_at cost has_limits < <(
  jq -r '[
    (.model.display_name // .model.id // "Claude"),
    (.model.id // ""),
    (.transcript_path // ""),
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
  local left=$(($1 - NOW))
  ((left < 0)) && left=0
  local m=$((left / 60)) h=$((left / 3600)) d=$((left / 86400))
  if ((d > 0)); then printf '%dd %dh' "$d" $((h % 24))
  elif ((h > 0)); then printf '%dh %dm' "$h" $((m % 60))
  else printf '%dm' "$m"; fi
}

# Prompt cache. Warm while the main thread's last response is under an hour old (Claude
# Code asks for the one-hour cache on a subscription; pay-as-you-go keys get five minutes).
# Read from the transcript, so it needs no mod (and no GNU date, so it runs on macOS too). A cold chat shows the tokens resuming it
# would write back into the cache against the tokens a new chat starts with (the first
# response's prompt: system prompt, tools, memory). Anthropic publishes no conversion from
# tokens to the 5h or weekly percentage, so none is shown.
CACHE_TTL=3600

# 850 -> 850, 174404 -> 174k, 1250000 -> 1.2M
tokens_short() {
  local n=$1
  if ((n >= 1000000)); then printf '%d.%dM' $((n / 1000000)) $((n % 1000000 / 100000))
  elif ((n >= 1000)); then printf '%dk' $((n / 1000))
  else printf '%d' "$n"; fi
}

cache_part() {
  [[ -r $transcript ]] || return
  local last first stamp tokens first_tokens at left
  # The fields of each main-thread response: its time and the tokens it was answered over.
  local fields='fromjson? | select(.type == "assistant" and (.isSidechain | not) and .message.usage)
    | [(.timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601), (.message.usage | .input_tokens + .cache_read_input_tokens + .cache_creation_input_tokens + .output_tokens)] | @tsv'
  last=$(tail -n 80 "$transcript" | jq -Rr "$fields" 2>/dev/null | tail -n 1)
  [[ -n $last ]] || return
  stamp=${last%%$'\t'*}
  tokens=${last##*$'\t'}
  at=$stamp
  [[ $at =~ ^[0-9]+$ ]] || return
  left=$((CACHE_TTL - (NOW - at)))
  if ((left > 0)); then
    printf '%s●%s %swarm %s%s' "$(fg "$GREEN")" "$RESET" "$(fg "$TEXT")" "$(until_time $((NOW + left)))" "$RESET"
    return
  fi
  first=$(grep -m5 '"type":"assistant"' "$transcript" | jq -Rr "$fields" 2>/dev/null | head -n 1)
  first_tokens=${first##*$'\t'}
  printf '%s○ cold · resume %s tokens · new chat %s%s' "$(fg "$DIM")" "$(tokens_short "$tokens")" "$(tokens_short "${first_tokens:-0}")" "$RESET"
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
cache=$(cache_part)
[[ -n $cache ]] && parts+=("$(fg "$DIM")cache$RESET $cache")
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
