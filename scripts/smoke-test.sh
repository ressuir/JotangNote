#!/usr/bin/env bash
# Real integration check: Spring Boot + MySQL + Redis + RabbitMQ.
# Requires running services and curl, jq, redis-cli.
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:8080}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
COOKIE_A="$TMP_DIR/alice.cookie"
COOKIE_B="$TMP_DIR/bob.cookie"
STAMP="$(date +%s)"
USER_A="smokea${STAMP}"
USER_B="smokeb${STAMP}"
PASSWORD="test-password-123"
TITLE="Smoke note ${STAMP}"
UPDATED="Updated smoke note ${STAMP}"

status() {
  curl -sS -o "$TMP_DIR/body" -w '%{http_code}' "$@"
}
require_status() {
  local actual="$1" expected="$2" context="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $context expected $expected, got $actual"
    cat "$TMP_DIR/body"
    exit 1
  fi
}
register() {
  local username="$1"
  local http
  http="$(status -H 'Content-Type: application/json' -X POST \
    -d "{\"username\":\"${username}\",\"password\":\"${PASSWORD}\"}" \
    "$BASE_URL/api/auth/register")"
  require_status "$http" 200 "register $username"
}
login() {
  local username="$1" cookie="$2"
  local http
  http="$(status -c "$cookie" -b "$cookie" -H 'Content-Type: application/json' -X POST \
    -d "{\"username\":\"${username}\",\"password\":\"${PASSWORD}\"}" \
    "$BASE_URL/api/auth/login")"
  require_status "$http" 200 "login $username"
}
for cmd in jq redis-cli curl; do
  command -v "$cmd" >/dev/null || { echo "Required command missing: $cmd"; exit 1; }
done

require_status "$(status "$BASE_URL/api/notes")" 401 "anonymous list"
register "$USER_A"
register "$USER_B"
login "$USER_A" "$COOKIE_A"
ID_A="$(jq -r '.id' < "$TMP_DIR/body")"
login "$USER_B" "$COOKIE_B"
echo "PASS: anonymous request 401; two users registered and logged in (HTTP 200)"

require_status "$(status -b "$COOKIE_A" -H 'Content-Type: application/json' -X POST \
  -d "{\"title\":\"${TITLE}\",\"content\":\"draft\"}" \
  "$BASE_URL/api/notes")" 202 "create note"

NOTE_ID=""
for i in {1..30}; do
  NOTE_ID="$(curl -sS -b "$COOKIE_A" "$BASE_URL/api/notes" |
    jq -r --arg title "$TITLE" '.[] | select(.title == $title) | .id' | head -n1)"
  [[ -n "$NOTE_ID" ]] && break
  sleep 0.5
done
[[ -n "$NOTE_ID" ]] || { echo "FAIL: MQ create did not appear"; exit 1; }
echo "PASS: RabbitMQ CREATE accepted 202 and MySQL note appeared (ID=$NOTE_ID)"

require_status "$(status -b "$COOKIE_B" "$BASE_URL/api/notes/$NOTE_ID")" 404 "other user read"
require_status "$(status -b "$COOKIE_B" -H 'Content-Type: application/json' -X PUT \
  -d '{"title":"forbidden","content":"x"}' \
  "$BASE_URL/api/notes/$NOTE_ID")" 404 "other user update"
require_status "$(status -b "$COOKIE_B" -X DELETE "$BASE_URL/api/notes/$NOTE_ID")" 404 "other user delete"
BOB_LIST="$(curl -sS -b "$COOKIE_B" "$BASE_URL/api/notes")"
echo "$BOB_LIST" | jq -e --argjson id "$NOTE_ID" 'map(select(.id == $id)) | length == 0' >/dev/null ||
  { echo "FAIL: other user's note leaked into list"; exit 1; }
echo "PASS: cross-user GET/PUT/DELETE denied (404) and list isolated"

require_status "$(status -b "$COOKIE_A" "$BASE_URL/api/notes/$NOTE_ID")" 200 "owner read"
require_status "$(status -b "$COOKIE_A" "$BASE_URL/api/notes/$NOTE_ID")" 200 "repeat read"
REDIS_KEY="note:${ID_A}:${NOTE_ID}"
CACHE_VALUE="$(redis-cli --raw GET "$REDIS_KEY")"
echo "$CACHE_VALUE" | jq -e --argjson id "$NOTE_ID" '.id == $id' >/dev/null ||
  { echo "FAIL: Redis did not cache the owner's note"; exit 1; }
TTL="$(redis-cli TTL "$REDIS_KEY")"
(( TTL > 0 && TTL <= 600 )) || { echo "FAIL: unexpected cache TTL=$TTL"; exit 1; }
echo "PASS: Redis cached owner note with positive TTL (key=note:<userId>:$NOTE_ID, TTL=$TTL s)"

require_status "$(status -b "$COOKIE_A" -H 'Content-Type: application/json' -X PUT \
  -d "{\"title\":\"${UPDATED}\",\"content\":\"changed\"}" \
  "$BASE_URL/api/notes/$NOTE_ID")" 202 "owner update"
UPDATED_OK=""
for i in {1..30}; do
  if curl -sS -b "$COOKIE_A" "$BASE_URL/api/notes/$NOTE_ID" |
    jq -e --arg title "$UPDATED" '.title == $title and .content == "changed"' >/dev/null; then
    UPDATED_OK=1
    break
  fi
  sleep 0.5
done
[[ -n "$UPDATED_OK" ]] || { echo "FAIL: MQ update not visible"; exit 1; }
echo "PASS: RabbitMQ UPDATE accepted 202, updated content visible (not stale cache)"

require_status "$(status -b "$COOKIE_A" -X DELETE "$BASE_URL/api/notes/$NOTE_ID")" 202 "owner delete"
DELETED_OK=""
for i in {1..30}; do
  if [[ "$(status -b "$COOKIE_A" "$BASE_URL/api/notes/$NOTE_ID")" == 404 ]]; then
    DELETED_OK=1
    break
  fi
  sleep 0.5
done
[[ -n "$DELETED_OK" ]] || { echo "FAIL: MQ delete not visible"; exit 1; }
if [[ "$(redis-cli EXISTS "$REDIS_KEY")" != "0" ]]; then
  echo "FAIL: Redis cache entry still exists after delete"
  exit 1
fi
echo "PASS: RabbitMQ DELETE accepted 202, GET became 404, Redis entry invalidated"
echo "PASS: register/login, owner-only reads, denied updates/deletes, async CRUD, cache invalidation"
