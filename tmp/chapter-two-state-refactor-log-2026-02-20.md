# Chapter Two-State Refactor Log (2026-02-20)

## Goal
- Remove draft/pending flow for chapter publishing.
- Keep only two active states for chapter operations:
  1) APPROVED (đã duyệt / đăng ngay)
  2) SCHEDULED (hẹn giờ đăng)
- Ensure this refactor does NOT update `manga.updatedAt` unexpectedly.

## Changed Files
1. app/.server/mutations/chapter.mutation.ts
   - `resolveIncomingStatus` now only accepts APPROVED/SCHEDULED.
   - `updateChapter` no longer forces status=PENDING.

2. app/routes/truyen-hentai.chapter.create.$mangaId.tsx
   - Removed `draft` mode from action parsing.
   - Create chapter now resolves status from only `now` or `schedule`.
   - Removed UI button "Lưu nháp".
   - `submitPublishModeRef` + submit handler only allow `now|schedule`.

3. app/routes/api.chapter.update-status.ts
   - API now only accepts APPROVED/SCHEDULED values.
   - Status updates keep chapter timestamps consistent:
     - APPROVED => set `publishedAt=now`, clear `publishAt`.
     - SCHEDULED => clear `publishedAt`.
   - No manga counter/time update in this API (avoids `manga.updatedAt` side effects).

4. app/components/chapter-status-dropdown.tsx
   - Dropdown now displays only:
     - Đã duyệt
     - Hẹn giờ đăng

5. scripts/ops/migrate-chapter-status-two-state.ts
   - Added migration script for legacy chapter statuses:
     - PENDING / REJECTED => APPROVED
     - clear `publishAt`, set `publishedAt` fallback
   - Does NOT touch manga documents, so `manga.updatedAt` remains unchanged.
   - Default mode: dry-run. Apply mode requires `--apply`.

6. package.json
   - Added script: `ops:migrate-chapter-status-two-state`.

## Safe Runbook
- Dry-run first:
  - `npm run ops:migrate-chapter-status-two-state`
- Apply globally:
  - `npm run ops:migrate-chapter-status-two-state -- --apply`
- Apply by manga:
  - `npm run ops:migrate-chapter-status-two-state -- --apply --manga=<MANGA_ID>`
- Limit batch while testing:
  - `npm run ops:migrate-chapter-status-two-state -- --apply --limit=100`

## Rollback
Restore changed files:

```bash
git restore \
  app/.server/mutations/chapter.mutation.ts \
  app/routes/truyen-hentai.chapter.create.$mangaId.tsx \
  app/routes/api.chapter.update-status.ts \
  app/components/chapter-status-dropdown.tsx \
  scripts/ops/migrate-chapter-status-two-state.ts \
  package.json
```

## Note
- This log is temporary for operational rollback convenience.
