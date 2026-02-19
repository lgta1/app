# Temporary Search Refactor Log (2026-02-19)

## Scope
Refactor basic search flow to:
- Remove realtime dropdown search requests.
- Use dedicated `/search` page only on submit (Enter).
- Cap search results on `/search` to **60**.
- Remove obsolete old API/search code path after usage verification.

## Usage Verification (before cleanup)
Checked workspace references for:
- `/api/search`
- `smartSearch(...)`
- `~/types/search`
- `header-search-item`

Result:
- Old chain was self-contained and had no remaining internal callers from active UI/routes.
- No active GET/POST flow in app code was still using the old endpoint after header/mobile refactor.

## Files Updated
1. `app/routes/search.tsx`
   - Changed `SEARCH_RESULT_LIMIT` from `40` -> `60`.

## Files Removed (obsolete)
1. `app/routes/api.search.tsx`
2. `app/services/search/smart-search.server.ts`
3. `app/types/search.ts`
4. `app/components/header-search-item.tsx`

## Existing New Flow (kept)
1. `app/components/header-search.tsx`
   - Submit-only search form to `/search`.
2. `app/components/mobile-search.tsx`
   - Submit-only search form to `/search`.
3. `app/services/search/basic-search.server.ts`
   - Lightweight text-index-based search service.
4. `scripts/ops/benchmark-smart-search.ts`
   - Benchmark limits 40/60/100.
5. `package.json`
   - Added script: `ops:benchmark-search`.

## Rollback Guide (file-level)
Run from project root:

```bash
git restore app/routes/search.tsx
```

Restore deleted legacy files:

```bash
git restore app/routes/api.search.tsx \
  app/services/search/smart-search.server.ts \
  app/types/search.ts \
  app/components/header-search-item.tsx
```

Restore all search-refactor touched files in one go:

```bash
git restore \
  app/components/header-search.tsx \
  app/components/mobile-search.tsx \
  app/routes/search.tsx \
  app/routes/api.search.tsx \
  app/services/search/basic-search.server.ts \
  app/services/search/smart-search.server.ts \
  app/types/search.ts \
  app/components/header-search-item.tsx \
  scripts/ops/benchmark-smart-search.ts \
  package.json
```

## Notes
- This is a temporary operational log for rollback convenience.
- There are unrelated modified files in repository not part of this search refactor.
