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
