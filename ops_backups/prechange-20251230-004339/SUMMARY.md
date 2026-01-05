# Pre-change Snapshot Summary

- Snapshot dir: ops_backups/prechange-20251230-004339
- Repo HEAD: 6c51becc4baef555040c1a5beae06c6d6011d85a
- Branch: master
- Working tree: clean
- PM2 process count (from jlist): 4
- App ports detected: :3001 :3002 :3003 :3004

## Notes
- Secrets policy: no env values captured; see runtime/pm2_env_keys.txt for env variable names only.
- Root/system snapshot may be pending: see system/ for nginx/systemd outputs.
- Rollback risk: Cloudflare/DNS/dashboard-only changes are not captured; record them separately if you touch them.

## Nginx Snapshot (root)

- nginx config test: see system/nginx.txt
- vhost excerpt: see system/vhost_excerpt.txt
- upstream/proxy hints (redacted):
