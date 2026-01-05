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
  - Compare listening ports to runtime/ports.txt (expected 3001-3004)
- If ecosystem file changed, restore it from git baseline then:
  - `pm2 reload ecosystem.config.cjs --update-env`
- If a single instance misbehaves:
  - `pm2 restart ww-<n>`

Note: environment variable VALUES are intentionally not captured in this snapshot. If you change secrets/.env values, you must restore them from your secret source of truth.

## Layer 4 — Nginx / System (root)
- Validate config:
  - `nginx -t`
- If vhost changed, revert `/etc/nginx/sites-available/vinahentai.com` to the baseline excerpt in system/vhost_excerpt.txt
- Reload only after confirmation:
  - `systemctl reload nginx`

## Non-code Risks
- External state changes (Cloudflare/DNS/object storage/secrets) are not fully snapshot-able here.
  - If you change those, record exact before/after settings separately.
