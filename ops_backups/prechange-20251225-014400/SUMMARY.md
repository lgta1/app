# Pre-change Snapshot Summary

- Snapshot dir: /home/devuser/ww-new/ops_backups/prechange-20251225-014400
- Repo HEAD: 6c51becc4baef555040c1a5beae06c6d6011d85a
- Branch: master
- Working tree: dirty (see repo/git.txt)
- PM2 (devuser): 4 instances (ww-1..ww-4), all online per runtime/pm2.txt
- App ports detected: :3001 :3002 :3003 :3004 (see runtime/ports.txt)
- Nginx upstream: `ww_backend` -> 127.0.0.1:3001-3004, `proxy_pass http://ww_backend` (see system/vhost_excerpt.txt)

## Notes
- Secrets policy: no env values captured; runtime/pm2.jlist.json is redacted and runtime/pm2_env_keys.txt contains env variable names only.
- Rollback risk: any changes outside this host (Cloudflare/DNS, object storage config, secrets manager/.env values) are not captured 1:1 here unless you record them separately.
