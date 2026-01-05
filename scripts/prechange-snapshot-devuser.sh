#!/usr/bin/env bash
set -euo pipefail
umask 077

SNAP_DIR="${1:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "$SNAP_DIR" ]]; then
  SNAP_DIR="ops_backups/prechange-$(date +%Y%m%d-%H%M%S)"
fi

LATEST_PTR="ops_backups/LATEST_PRECHANGE_SNAPSHOT.txt"

mkdir -p "$SNAP_DIR"/{repo,runtime,system}

printf '%s\n' "$SNAP_DIR" >"$LATEST_PTR"

redact_stream() {
  if command -v perl >/dev/null 2>&1; then
    perl -pe '
      s/(\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|KEY|AUTH|COOKIE|SESSION|PRIVATE|ACCESS|AWS|S3|R2|MINIO|CF|CLOUDFLARE|MONGO|DATABASE|DB)_?[A-Z0-9_]*\b)\s*[:=]\s*([^\r\n]*)/$1: (set)/g;
      s#(mongodb(?:\+srv)?:\/\/)[^\s\"\x27]+#$1<redacted>#g;
      s#(postgres(?:ql)?:\/\/)[^\s\"\x27]+#$1<redacted>#g;
      s#(mysql:\/\/)[^\s\"\x27]+#$1<redacted>#g;
      s#(redis:\/\/)[^\s\"\x27]+#$1<redacted>#g;
      s#(https?:\/\/)([^\/@\s]+):([^\/@\s]+)@#$1<redacted>:<redacted>@#g;
      s#\bAKIA[0-9A-Z]{16}\b#<redacted>#g;
    '
  elif command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import re, sys
s = sys.stdin.read()
s = re.sub(r'(\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|KEY|AUTH|COOKIE|SESSION|PRIVATE|ACCESS|AWS|S3|R2|MINIO|CF|CLOUDFLARE|MONGO|DATABASE|DB)_?[A-Z0-9_]*\b)\s*[:=]\s*([^\r\n]*)', r'\1: (set)', s)
s = re.sub(r'(mongodb(?:\+srv)?:\/\/)[^\s"\']+', r'\1<redacted>', s)
s = re.sub(r'(postgres(?:ql)?:\/\/)[^\s"\']+', r'\1<redacted>', s)
s = re.sub(r'(mysql:\/\/)[^\s"\']+', r'\1<redacted>', s)
s = re.sub(r'(redis:\/\/)[^\s"\']+', r'\1<redacted>', s)
s = re.sub(r'(https?:\/\/)([^\/@\s]+):([^\/@\s]+)@', r'\1<redacted>:<redacted>@', s)
s = re.sub(r'\bAKIA[0-9A-Z]{16}\b', r'<redacted>', s)
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

write_file() {
  local out="$1"; shift
  {
    echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    "$@"
  } >"$out" 2>&1
}

# --- Step 1: Git snapshot ---
GIT_OUT="$SNAP_DIR/repo/git.txt"
: >"$GIT_OUT"
run_cmd "$GIT_OUT" "git rev-parse HEAD"
run_cmd "$GIT_OUT" "git log -1 --oneline"
run_cmd "$GIT_OUT" "git status --porcelain"
run_cmd "$GIT_OUT" "git diff | redact_stream"
run_cmd "$GIT_OUT" "git diff --staged | redact_stream"
run_cmd "$GIT_OUT" "git branch --show-current"
run_cmd "$GIT_OUT" "git remote -v | redact_stream"

# List untracked (full paths) if any
run_cmd "$GIT_OUT" "git ls-files --others --exclude-standard"

# --- Step 2: App runtime snapshot (PM2/Node/Ports) ---
PM2_OUT="$SNAP_DIR/runtime/pm2.txt"
: >"$PM2_OUT"
run_cmd "$PM2_OUT" "command -v pm2 && pm2 ls"

# pm2 jlist can be large: write to its own file
PM2_JLIST="$SNAP_DIR/runtime/pm2.jlist.json"
{
  echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "$ pm2 jlist (redacted) > $PM2_JLIST"
  echo
  if command -v pm2 >/dev/null 2>&1; then
    tmp_json="$(mktemp)"
    set +e
    pm2 jlist >"$tmp_json" 2>/dev/null || pm2 jlist >"$tmp_json" 2>&1
    rc=$?
    set -e
    if [[ $rc -eq 0 ]] && command -v node >/dev/null 2>&1; then
      PM2_JLIST_TMP="$tmp_json" PM2_JLIST_OUT="$PM2_JLIST" node <<'NODE'
const fs = require('fs');
const input = process.env.PM2_JLIST_TMP;
const output = process.env.PM2_JLIST_OUT;
let data;
try { data = JSON.parse(fs.readFileSync(input,'utf8')); } catch (e) {
  fs.writeFileSync(output, JSON.stringify({ error: 'parse_failed', message: e.message }) + '\n');
  process.exit(0);
}
if (!Array.isArray(data)) {
  fs.writeFileSync(output, JSON.stringify({ error: 'unexpected_shape' }) + '\n');
  process.exit(0);
}
for (const proc of data) {
  if (proc && typeof proc === 'object') {
    if (proc.pm2_env && typeof proc.pm2_env === 'object') {
      const envObj = proc.pm2_env.env && typeof proc.pm2_env.env === 'object' ? proc.pm2_env.env : null;
      if (envObj) proc.pm2_env.env_keys = Object.keys(envObj).sort();
      delete proc.pm2_env.env;
      delete proc.pm2_env.env_diff;
      delete proc.pm2_env.env_production;
      delete proc.pm2_env.axm_options;
    }
    delete proc.env;
  }
}
fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
NODE
      echo "[exit=$rc]"
    else
      echo "pm2 jlist captured but NOT redacted (node missing or error). Deleting temp to avoid secret leakage." 
      rm -f "$tmp_json"
      echo "[exit=$rc]"
      rc=0
    fi
    rm -f "$tmp_json"
  else
    echo "pm2: not found"
    echo "[exit=127]"
  fi
} >>"$PM2_OUT" 2>&1

# Describe expected processes
for name in ww-1 ww-2 ww-3 ww-4; do
  run_cmd "$PM2_OUT" "pm2 describe $name | redact_stream"
done

# Secret-safe env snapshot: keys only (no values). We DO NOT run `pm2 env`.
PM2_ENV_KEYS="$SNAP_DIR/runtime/pm2_env_keys.txt"
{
  echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "NOTE: Skipped 'pm2 env <id>' to avoid leaking secrets."
  echo "Only recording environment variable NAMES (keys) from pm2 jlist."
  echo
  if [[ -s "$PM2_JLIST" ]] && command -v node >/dev/null 2>&1; then
    PM2_JLIST="$PM2_JLIST" node <<'NODE'
const fs = require('fs');
const path = process.env.PM2_JLIST;
let data;
try {
  data = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch (e) {
  console.log('Unable to parse pm2 jlist JSON:', e.message);
  process.exit(0);
}
if (!Array.isArray(data)) {
  console.log('pm2 jlist: unexpected JSON shape');
  process.exit(0);
}
for (const p of data) {
  const name = p?.name ?? '(unknown)';
  const pm_id = p?.pm_id ?? '(unknown)';
  const keys = Array.isArray(p?.pm2_env?.env_keys) ? p.pm2_env.env_keys : [];
  console.log(`Process: ${name} (pm_id=${pm_id})`);
  if (keys.length === 0) {
    console.log('  env keys: (none)');
  } else {
    console.log('  env keys:');
    for (const k of keys) console.log(`    - ${k}`);
  }
  console.log('');
}
NODE
  else
    echo "pm2 jlist missing or node not available; cannot extract env keys."
  fi
} >"$PM2_ENV_KEYS" 2>&1

NODE_OUT="$SNAP_DIR/runtime/node.txt"
: >"$NODE_OUT"
run_cmd "$NODE_OUT" "node -v"
run_cmd "$NODE_OUT" "npm -v"

PORTS_OUT="$SNAP_DIR/runtime/ports.txt"
: >"$PORTS_OUT"
run_cmd "$PORTS_OUT" "ss -lntp | egrep ':(3001|3002|3003|3004)' || true"

# --- Step 3: Build/artifacts snapshot ---
BUILD_OUT="$SNAP_DIR/runtime/build.txt"
: >"$BUILD_OUT"
run_cmd "$BUILD_OUT" "ls -la build build/client build/server 2>/dev/null || true"
run_cmd "$BUILD_OUT" "stat -c '%y %U:%G %a %n' build build/client build/server 2>/dev/null || true"

# --- SUMMARY + ROLLBACK placeholders (filled/updated by root or later) ---
SUMMARY="$SNAP_DIR/SUMMARY.md"
ROLLBACK="$SNAP_DIR/ROLLBACK.md"

git_head="$(git rev-parse HEAD 2>/dev/null || true)"
branch="$(git branch --show-current 2>/dev/null || true)"
wt_dirty="clean"
if [[ -n "$(git status --porcelain 2>/dev/null || true)" ]]; then
  wt_dirty="dirty"
fi

pm2_count="unknown"
if [[ -s "$PM2_JLIST" ]] && command -v node >/dev/null 2>&1; then
  pm2_count="$(P="$PM2_JLIST" node -e "try{const a=require('fs').readFileSync(process.env.P,'utf8');const j=JSON.parse(a);process.stdout.write(String(Array.isArray(j)?j.length:'unknown'));}catch(e){process.stdout.write('unknown');}")"
fi

ports_list="(see runtime/ports.txt)"
if [[ -s "$PORTS_OUT" ]]; then
  ports_list="$(grep -Eo ':(3001|3002|3003|3004)' "$PORTS_OUT" | sort -u | tr '\n' ' ' | sed 's/[[:space:]]\+$//')"
  [[ -z "$ports_list" ]] && ports_list="(none detected)"
fi

cat >"$SUMMARY" <<EOF
# Pre-change Snapshot Summary

- Snapshot dir: $SNAP_DIR
- Repo HEAD: $git_head
- Branch: $branch
- Working tree: $wt_dirty
- PM2 process count (from jlist): $pm2_count
- App ports detected: $ports_list

## Notes
- Secrets policy: no env values captured; see runtime/pm2_env_keys.txt for env variable names only.
- Root/system snapshot may be pending: see system/ for nginx/systemd outputs.
- Rollback risk: Cloudflare/DNS/dashboard-only changes are not captured; record them separately if you touch them.
EOF

cat >"$ROLLBACK" <<'EOF'
# Rollback Plan (Layered)

This rollback plan assumes you want a 1:1 revert to the baseline captured by this snapshot.

## Layer 1 — Repository / Code
- If you changed code locally:
  - Review changes: `git status` and `git diff`
  - Revert tracked changes: `git restore .`
  - Revert staged changes: `git restore --staged .`
- If you deployed a different commit:
  - Check baseline commit in repo/git.txt
  - Reset working copy to baseline commit:
    - `git fetch --all --prune`
    - `git checkout <baseline-branch>`
    - `git reset --hard <baseline-commit>`

## Layer 2 — Build Artifacts
- Rebuild to match baseline commit:
  - `npm ci` (or your lockfile-based install)
  - `npm run build`
- Verify timestamps/permissions vs runtime/build.txt

## Layer 3 — PM2 Runtime (devuser)
- Verify current process set:
  - Compare `pm2 ls` to runtime/pm2.txt
- If ecosystem file changed, restore it from git baseline then:
  - `pm2 reload ecosystem.config.cjs --update-env`
- If a single instance misbehaves:
  - `pm2 restart ww-<n>`

## Layer 4 — Nginx / System (root)
- Validate config:
  - `nginx -t`
- If vhost changed, revert `/etc/nginx/sites-available/vinahentai.com` to the baseline excerpt in system/vhost_excerpt.txt
- Reload only after confirmation:
  - `systemctl reload nginx`

## Layer 5 — External (not captured)
- Cloudflare: cache rules, page rules, transforms, Zaraz/Web Analytics injections
- DNS: records and SSL/TLS mode changes
- Secrets managers / env values: intentionally NOT captured
EOF

echo "OK: devuser snapshot written to $SNAP_DIR" >&2
echo "LATEST: $(cat "$LATEST_PTR")" >&2
