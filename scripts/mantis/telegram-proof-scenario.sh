#!/usr/bin/env bash
# Shell helpers for one frozen Mantis Telegram scenario.
# The same script is replayed against baseline and candidate; only MANTIS_LANE and
# MANTIS_REPO_ROOT change.

set -euo pipefail

: "${MANTIS_LANE:?MANTIS_LANE is required}"
: "${MANTIS_REPO_ROOT:?MANTIS_REPO_ROOT is required}"
: "${MANTIS_SCENARIO_DIR:?MANTIS_SCENARIO_DIR is required}"
: "${MANTIS_LANE_OUTPUT_DIR:?MANTIS_LANE_OUTPUT_DIR is required}"
: "${OPENCLAW_TELEGRAM_MANTIS_LANE_CMD:?OPENCLAW_TELEGRAM_MANTIS_LANE_CMD is required}"

case "$MANTIS_LANE" in
  baseline | candidate) ;;
  *)
    echo "Invalid MANTIS_LANE: $MANTIS_LANE" >&2
    exit 64
    ;;
esac

mkdir -p "$MANTIS_LANE_OUTPUT_DIR"

proof_asset() {
  local relative="$1"
  [[ -n "$relative" && "$relative" != /* && "$relative" != *".."* ]]
  printf '%s/%s\n' "$MANTIS_SCENARIO_DIR" "$relative"
}

proof_lane() {
  local command="$1"
  shift
  "$OPENCLAW_TELEGRAM_MANTIS_LANE_CMD" "$command" --lane "$MANTIS_LANE" "$@"
}

proof_start() {
  local config="${1:-config.json}"
  proof_lane start \
    --repo-root "$MANTIS_REPO_ROOT" \
    --config "$(proof_asset "$config")" \
    | tee "$MANTIS_LANE_OUTPUT_DIR/start.json"
}

proof_mock_text() {
  local response_file="$1"
  shift
  proof_lane mock --response-file "$(proof_asset "$response_file")" "$@" \
    | tee "$MANTIS_LANE_OUTPUT_DIR/mock.json"
}

proof_mock_events() {
  local events_file="$1"
  proof_lane mock --response-events-file "$(proof_asset "$events_file")" \
    | tee "$MANTIS_LANE_OUTPUT_DIR/mock.json"
}

proof_mock_script() {
  local script_file="$1"
  local script_path
  script_path="$(proof_asset "$script_file")"
  local digest
  digest="$(sha256sum "$script_path" | cut -d ' ' -f1)"
  proof_lane mock --script "$script_path" --script-sha256 "$digest" \
    | tee "$MANTIS_LANE_OUTPUT_DIR/mock.json"
}

proof_send() {
  proof_lane send "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/send.json"
}

proof_turn() {
  proof_lane turn "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/turn.json"
}

proof_observe() {
  proof_lane observe "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/observe.json"
}

proof_press() {
  proof_lane press "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/press.json"
}

proof_delete() {
  proof_lane delete "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/delete.json"
}

proof_desktop() {
  local actions_file="$1"
  shift
  proof_lane desktop --actions-file "$(proof_asset "$actions_file")" "$@" \
    | tee "$MANTIS_LANE_OUTPUT_DIR/desktop.json"
}

proof_screenshot() {
  proof_lane screenshot | tee "$MANTIS_LANE_OUTPUT_DIR/screenshot.json"
}

proof_view() {
  proof_lane view "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/view.json"
}

proof_exec() {
  local command="$1"
  shift || true
  proof_lane exec --command "$command" "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/exec.json"
}

proof_exec_file() {
  local command_file="$1"
  shift
  proof_lane exec --command-file "$(proof_asset "$command_file")" "$@" \
    | tee "$MANTIS_LANE_OUTPUT_DIR/exec.json"
}

proof_restart() {
  proof_lane restart "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/restart.json"
}

proof_finish() {
  proof_lane finish "$@" | tee "$MANTIS_LANE_OUTPUT_DIR/finish.json"
}

proof_abort() {
  proof_lane abort >/dev/null 2>&1 || true
}

proof_message_id() {
  local result_file="${1:-$MANTIS_LANE_OUTPUT_DIR/send.json}"
  jq -er '.sent.messageId // .sent.message_id // .sent.id' "$result_file"
}

proof_cursor() {
  local result_file="$1"
  jq -er '.cursor' "$result_file"
}

proof_require_text() {
  local result_file="$1"
  local literal="$2"
  jq -e --arg literal "$literal" '.. | strings | select(contains($literal))' "$result_file" >/dev/null
}
