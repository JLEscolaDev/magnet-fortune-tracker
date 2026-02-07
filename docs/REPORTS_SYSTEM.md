# Reports System (Technical)

This document describes the current Reports pipeline end-to-end: data extraction, encryption, rollups, AI generation, and benchmarks.

## 1) Overview
- UI route: `/reports`
- Edge functions: `report-list`, `report-get`, `report-generate`
- Storage: `public.reports.content` (encrypted JSON or legacy markdown)
- Report types: `weekly`, `quarterly`, `annual`

The UI talks only to Edge Functions; the database stores encrypted report content.

## 2) `public.reports` table (relevant columns)
- `id uuid`
- `user_id uuid`
- `report_type text` (`weekly|quarterly|annual`)
- `period_start date`
- `period_end date`
- `title text`
- `content text` (encrypted payload, prefix `enc:v1:`)
- `year int`
- `status text` (`generating|ready|error`)
- `error_message text`
- `created_at timestamptz`
- `updated_at timestamptz`

**Important**: `content` always stores ciphertext with the `enc:v1:` prefix for new reports.

## 3) Incremental encryption
- Encryption helpers live in `/Users/jle/projects/Projects/magnet-fortune-tracker/supabase/functions/_shared/crypto.ts`.
- `encryptFieldV1()` stores `enc:v1:<base64>`.
- `decryptFieldMaybe()` returns plaintext if prefixed, otherwise returns legacy plaintext unchanged.

**Required secrets**:
- `SUPABASE_DB_URL`
- `DATA_ENCRYPTION_KEY_V1`
- Optional: `DATA_ENCRYPTION_KEY_PREV`

## 4) Report JSON model (ReportModelV1)
The source of truth is JSON stored inside `content` (encrypted).

```json
{
  "schema_version": 1,
  "report_type": "weekly|quarterly|annual",
  "period": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD",
    "title": "string"
  },
  "generated_at": "ISO",
  "executive_summary": "string",
  "dashboard": {
    "fortunes": { "before": 0, "in_period": 0, "total_at_end": 0, "delta": 0 },
    "entries_total": 0,
    "notes_with_content": 0,
    "dreams_with_content": 0,
    "meals_with_content": 0,
    "mood_distribution": { "good": 2 },
    "averages": {
      "energy": 0,
      "dream_quality": 0,
      "sickness": 0,
      "sexual_appetite": 0,
      "sexual_performance": 0
    }
  },
  "sections": [
    { "id": "visual_dashboard", "title": "...", "blocks": [] },
    { "id": "pattern_lab", "title": "...", "blocks": [] },
    { "id": "weekly_quests", "title": "...", "blocks": [] },
    { "id": "highlights", "title": "...", "blocks": [] },
    { "id": "context_future", "title": "...", "blocks": [] }
  ],
  "patterns": [
    { "pattern": "...", "evidence": ["..."], "confidence": "low|medium|high", "suggestion": "...", "why": "..." }
  ],
  "quests": [
    { "title": "...", "metric": "...", "target": 3, "why": "...", "difficulty": "easy|medium|hard" }
  ],
  "future_context": ["..."]
}
```

### Blocks supported
- `stat_card` (title, value, subtitle, trend)
- `bar_chart` (title, data, yMin/yMax)
- `line_chart` (title, data, series, yMin/yMax)
- `bullet_list`
- `callout` (tone, badge, content)
- `table`
- `markdown`
- `quest_list`

**Charts** may include fixed-axis fields: `yMin` and `yMax`.

## 5) Weekly rollup
Weekly reports add a structured rollup for quarterly/annual composition.

```json
"weekly_rollup": {
  "week_start": "YYYY-MM-DD",
  "week_end": "YYYY-MM-DD",
  "entries_total": 0,
  "notes_with_content": 0,
  "dreams_with_content": 0,
  "meals_with_content": 0,
  "mood_distribution": { "good": 1 },
  "averages": { "energy": 3.2, "dream_quality": 2.1, "sickness": 1.5, "sexual_appetite": 2.8, "sexual_performance": 3.0 },
  "trend": { "energy": "flat", "dream_quality": "down", "sickness": "up", "libido": "insufficient" },
  "volatility": { "energy_sd": 0.7, "dream_sd": 0.4, "sickness_sd": 0.2 },
  "anomalies": { "energy_spikes": 1, "dream_dips": 0 },
  "signals": { "work_stress_hits": 2, "sleep_disruption_hits": 1, "alcohol_hits": 0 },
  "top_keywords": ["work", "stress"],
  "top_highlights": [{ "date": "YYYY-MM-DD", "label": "Notes", "text": "..." }]
}
```

**Legacy** weekly reports without `weekly_rollup` are ignored by rollup composition.

## 6) Quarterly/annual rollup composition
For quarterly/annual generation:
1. Fetch weekly reports in the date range.
2. Decrypt + parse JSON and extract `weekly_rollup`.
3. Aggregate rollups into quarterly/annual dashboard + series.
4. If missing weeks, fill using raw `lifestyle_entries` from the period.

A `rollup_inputs` block records traceability:
```json
"rollup_inputs": {
  "weekly_reports_used": 8,
  "weekly_reports_missing": 2,
  "weekly_report_ids": ["uuid", "uuid"],
  "used_raw_fallback": true
}
```

## 7) Benchmarks (community averages)
RPC: `report_global_averages(date, date)`
- Returns aggregated averages for **non-encrypted** metrics.
- Includes `entries_total` to help gauge sample size.

Returned fields (current):
- `entries_total`
- `avg_energy`, `avg_dream`, `avg_sickness`, `avg_appetite`, `avg_performance`
- `mood_good`, `mood_very_good`, `mood_neutral`, `mood_bad`, `mood_very_bad`

If the RPC fails, benchmarks are omitted (report still generates).

## 8) Edge Functions API
### `report-list`
**POST** `{ year?: number }`
- Defaults to current UTC year.
- Response: `{ reports: Array<{ id, report_type, period_start, period_end, title, status, created_at, updated_at, year }> }`

### `report-get`
**POST** `{ report_id: uuid }`
- Response: `{ report: { ...db fields..., content: decrypted_string } }`
- `content` is a string (JSON or legacy markdown).

### `report-generate`
**POST**
- weekly: `{ report_type: 'weekly', weekStart: 'YYYY-MM-DD', force?: boolean }`
- quarterly: `{ report_type: 'quarterly', year: 2026, quarter: 1|2|3|4, force?: boolean }`
- annual: `{ report_type: 'annual', year: 2026, force?: boolean }`

Behavior:
- Idempotent: if report exists and `force != true`, returns existing.
- If `force = true`, regenerates and updates same row.
- Periods are strict (weekly must be Monday).
- Returns decrypted JSON string in `report.content`.

## 9) AI pipeline
- AI-first, attempts JSON output then markdown fallback.
- 3 attempts:
  1) JSON mode (`response_format: json_object`)
  2) JSON retry (without json mode, stricter prompt)
  3) Markdown-only prompt (wrapped into JSON)
- If all fail: deterministic base report is used.
- AI cannot override computed metrics or charts; base data is enforced after merge.

## 10) Status + error_message
- `status`: `generating`, `ready`, `error`
- `error_message`:
  - `fallback_used` (AI failed, base report used)
  - `ai_failed` (fatal AI error)
  - or a runtime error string (if any)

## 11) Access rules
Entitlements enforced server-side (see `/Users/jle/projects/Projects/magnet-fortune-tracker/supabase/functions/_shared/report-utils.ts`).
- `none` / `essential`: no access (403)
- `growth`: weekly + annual
- `pro` / `lifetime`: weekly + quarterly + annual
- Trial users are treated as `pro`.

## 12) Verification checklist
1. `/reports` loads and lists periods.
2. Generate weekly report and verify `weekly_rollup` exists in decrypted JSON.
3. Generate quarterly/annual and verify `rollup_inputs` and weekly aggregation.
4. `report-get` returns decrypted JSON string.
5. Benchmarks appear when RPC is available.

## References (files)
- `/Users/jle/projects/Projects/magnet-fortune-tracker/supabase/functions/report-generate/index.ts`
- `/Users/jle/projects/Projects/magnet-fortune-tracker/supabase/functions/report-list/index.ts`
- `/Users/jle/projects/Projects/magnet-fortune-tracker/supabase/functions/report-get/index.ts`
- `/Users/jle/projects/Projects/magnet-fortune-tracker/supabase/functions/_shared/report-utils.ts`
- `/Users/jle/projects/Projects/magnet-fortune-tracker/supabase/functions/_shared/crypto.ts`
