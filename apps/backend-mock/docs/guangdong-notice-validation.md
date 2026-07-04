# Guangdong Notice Validation

## Current Scope

This repository reads from `spider.notices` through `/notices/list`, but no writer for `spider.notices` was found in this repository. Database inspection also found no trigger, event, or routine that writes or repairs `notices`.

The upstream crawler should call the same validator before inserting rows into `notices`.

## Before Insert

After the crawler receives list rows and before it writes to `notices`, validate each Guangdong platform detail link:

```ts
import { filterValidGuangdongNoticeCandidatesBeforeInsert } from './utils/guangdong-notice-detail-validator';

const { validRows, invalidRows } =
  await filterValidGuangdongNoticeCandidatesBeforeInsert(listRows);

// Only write validRows into notices.
// invalidRows contains the original item and the invalid reason for logging.
```

A row is considered valid only when the Guangdong detail API returns both:

- non-empty `data.title`
- non-empty `data.tradingNoticeColumnModelList`

Timeouts, "no data" responses, and malformed detail payloads are treated as invalid before insert.

## Existing Data

Historical rows are not physically deleted. They are marked with:

- `is_valid`
- `invalid_reason`
- `last_checked_at`

Run a dry-run:

```bash
pnpm -F @vben/backend-mock run notices:cleanup:gd -- --limit=50
```

Execute a small batch:

```bash
pnpm exec tsx apps/backend-mock/scripts/cleanup-invalid-guangdong-notices.ts --limit=200 --execute=true
```

The backend worker also runs a daily cleanup and rechecks a small batch of previously invalid rows, so rows can be restored if the platform detail later becomes valid again.

`DETAIL_FETCH_FAILED` and `DETAIL_EMPTY_OR_LOADING` are transient platform/network failures during historical cleanup. They are reported in script output as `transient`, but are not written to `notices` and do not hide a row from `/notices/list`.
