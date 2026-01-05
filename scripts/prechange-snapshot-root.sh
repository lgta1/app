#!/usr/bin/env bash
set -euo pipefail
umask 077

SNAP_DIR="${1:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LATEST_PTR="ops_backups/LATEST_PRECHANGE_SNAPSHOT.txt"

if [[ -z "$SNAP_DIR" ]]; then
  if [[ -f "$LATEST_PTR" ]] && [[ -n "$(cat "$LATEST_PTR" 2>/dev/null || true)" ]]; then
    SNAP_DIR="$(cat "$LATEST_PTR" 2>/dev/null || true)"
  else
    SNAP_DIR="ops_backups/prechange-$(date +%Y%m%d-%H%M%S)"
    printf '%s\n' "$SNAP_DIR" >"$LATEST_PTR"
  fi
fi

mkdir -p "$SNAP_DIR/system"

redact_stream() {
  if command -v perl >/dev/null 2>&1; then
    perl -pe '
      s/(\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|KEY|AUTH|COOKIE|SESSION|PRIVATE|ACCESS|AWS|S3|R2|MINIO|CF|CLOUDFLARE|MONGO|DATABASE|DB)_?[A-Z0-9_]*\b)\s*[:=]\s*([^\r\n]*)/$1: (set)/g;
      s#(mongodb(?:\+srv)?:\/\/)[^\s\"\x27]+#$1<redacted>#g;
      s#(https?:\/\/)([^\/@\s]+):([^\/@\s]+)@#$1<redacted>:<redacted>@#g;
    '
  elif command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import re, sys
s = sys.stdin.read()
s = re.sub(r'(\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|KEY|AUTH|COOKIE|SESSION|PRIVATE|ACCESS|AWS|S3|R2|MINIO|CF|CLOUDFLARE|MONGO|DATABASE|DB)_?[A-Z0-9_]*\b)\s*[:=]\s*([^\r\n]*)', r'\1: (set)', s)
s = re.sub(r'(mongodb(?:\+srv)?:\/\/)[^\s"\']+', r'\1<redacted>', s)
s = re.sub(r'(https?:\/\/)([^\/@\s]+):([^\/@\s]+)@', r'\1<redacted>:<redacted>@', s)
sys.stdout.write(s)
PY
  else
    cat
  fi
}

run_cmd() {
  local out="$1"; shift
  local cmd="$*"
  {
    echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "$ $cmd"
    echo
    local rc
    set +e
    eval "$cmd"
    rc=$?
    set -e
    echo
    echo "[exit=$rc]"
  } >>"$out" 2>&1
}

NGINX_OUT="$SNAP_DIR/system/nginx.txt"
: >"$NGINX_OUT"
run_cmd "$NGINX_OUT" "nginx -v 2>&1 | redact_stream"
run_cmd "$NGINX_OUT" "nginx -t 2>&1 | redact_stream"
# nginx -T can be very long; still capture fully
run_cmd "$NGINX_OUT" "nginx -T 2>&1 | redact_stream"

SYSTEMD_OUT="$SNAP_DIR/system/systemd.txt"
: >"$SYSTEMD_OUT"
run_cmd "$SYSTEMD_OUT" "systemctl status nginx --no-pager"

VHOST_OUT="$SNAP_DIR/system/vhost_excerpt.txt"
: >"$VHOST_OUT"
run_cmd "$VHOST_OUT" "sed -n '1,260p' /etc/nginx/sites-available/vinahentai.com | redact_stream"

MTIME_OUT="$SNAP_DIR/system/nginx_mtime.txt"
: >"$MTIME_OUT"
run_cmd "$MTIME_OUT" "stat -c '%y %U:%G %a %n' /etc/nginx/nginx.conf /etc/nginx/sites-available/vinahentai.com"

SUMMARY="$SNAP_DIR/SUMMARY.md"
if [[ -f "$SUMMARY" ]]; then
  sed -i 's/^- Root\/system snapshot may be pending:.*$/- Root\/system snapshot captured: see system\/ for nginx\/systemd outputs./' "$SUMMARY" 2>/dev/null || true
  {
    echo
    echo "## Nginx Snapshot (root)"
    echo
    echo "- nginx config test: see system/nginx.txt"
    echo "- vhost excerpt: see system/vhost_excerpt.txt"
    echo "- upstream/proxy hints (redacted):"
    if [[ -s "$VHOST_OUT" ]]; then
      grep -nE '(^\s*upstream\b|\bproxy_pass\b|\bfastcgi_pass\b|\bserver_name\b|\blisten\b)' "$VHOST_OUT" \
        | head -n 80 \
        | redact_stream \
        | sed 's/^/  - /'
    else
      echo "  - (no vhost excerpt captured)"
    fi
  } >>"$SUMMARY" 2>&1
fi

echo "OK: root snapshot written to $SNAP_DIR/system" >&2
echo "LATEST: $(cat "$LATEST_PTR" 2>/dev/null || true)" >&2
