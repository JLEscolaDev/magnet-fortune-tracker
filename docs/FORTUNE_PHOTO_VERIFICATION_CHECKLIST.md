# Fortune Photo Upload & Refresh Verification Checklist

**Last Updated**: 2025-01-27

Use this checklist to verify the Fortune photo upload and refresh pipeline works correctly across Web, iOS, and Supabase Edge Functions.

## Pre-Deployment Checks

### 1. Code Alignment
- [ ] `issue-fortune-upload-ticket` access gating matches `finalize-fortune-photo`:
  - Query: `select('status, is_lifetime')` (no `current_period_end`)
  - Logic: Lifetime = `is_lifetime=true AND status='active'`
  - Logic: Recurring = `status IN ('active','trialing')`
- [ ] Both edge functions have `BUILD_TAG` constant
- [ ] Both edge functions log `BUILD_TAG` in request logs
- [ ] Both edge functions return `buildTag` in response JSON

### 2. Web Client
- [ ] `src/lib/nativeUploader.ts` uses `POST` with `FormData`
- [ ] Form field name matches `formFieldName` from ticket response
- [ ] Includes `x-upsert: true` header
- [ ] Does NOT manually set `Content-Type` header

### 3. iOS Client (if in separate repo)
- [ ] Upload code uses `POST` method (not PUT)
- [ ] Creates multipart form data with field name `file`
- [ ] Includes `x-upsert: true` header
- [ ] Sets `Content-Type` with boundary

## Web Verification

### Upload Flow
1. [ ] Open app in browser (dev mode with mock uploader)
2. [ ] Create or edit a fortune
3. [ ] Click "Attach Photo"
4. [ ] Select an image file
5. [ ] Verify console logs show:
   - `[MOCK UPLOADER] TICKET_REQUEST`
   - `[MOCK UPLOADER] TICKET_OK`
   - `[MOCK UPLOADER] UPLOAD_OK`
   - `[MOCK UPLOADER] FINALIZE_OK`
6. [ ] Verify success toast appears
7. [ ] Verify photo appears in fortune modal immediately

### Refresh Flow (Replace Photo)
1. [ ] Open a fortune with an existing photo
2. [ ] Click "Attach Photo" again
3. [ ] Select a different image
4. [ ] Verify console logs show:
   - `[PHOTO-UPLOAD] DB_UPDATE_CONFIRMED`
   - `[PHOTO-UPLOAD] Dispatching fortunesUpdated event`
5. [ ] Verify new photo appears in modal immediately
6. [ ] Navigate to "Today's Fortunes"
7. [ ] Verify new photo appears in list (no manual refresh needed)
8. [ ] Verify console logs show:
   - `[HOME-TAB] fortunesUpdated event received`
   - `[FORTUNE-PHOTO] fortunesUpdated event received`
   - `[FORTUNE-LIST] FortunePhoto rendered` with new `updated_at`

### Cache-Busting
1. [ ] Upload a photo
2. [ ] Note the `updated_at` value from finalize response
3. [ ] Check browser DevTools Network tab
4. [ ] Verify signed URL includes `?v=<updated_at>` parameter
5. [ ] Replace the photo
6. [ ] Verify new `updated_at` is different
7. [ ] Verify new signed URL has new `v=` parameter

## iOS Verification (Production)

### Upload Flow
1. [ ] Open app on iOS device
2. [ ] Create or edit a fortune
3. [ ] Tap "Attach Photo"
4. [ ] Select photo from library or camera
5. [ ] Verify photo appears in modal
6. [ ] Verify no errors in Xcode console

### Refresh Flow (Replace Photo)
1. [ ] Open a fortune with existing photo
2. [ ] Tap "Attach Photo" again
3. [ ] Select different photo
4. [ ] Verify new photo appears in modal
5. [ ] Navigate to "Today's Fortunes"
6. [ ] Verify new photo appears in list (no app restart)

### Storage Verification
1. [ ] After upload, check Supabase Storage dashboard
2. [ ] Navigate to `photos` bucket
3. [ ] Verify file exists at path: `<userId>/<fortuneId>-<random>.ext`
4. [ ] Verify file is accessible (not corrupted)

## Supabase Edge Functions Verification

### Logs Check
1. [ ] Open Supabase Dashboard → Edge Functions → Logs
2. [ ] Trigger a photo upload
3. [ ] Verify logs show:
   - `issue-fortune-upload-ticket: Request received { BUILD_TAG: '...' }`
   - `issue-fortune-upload-ticket: TICKET_OK { BUILD_TAG: '...' }`
   - `finalize-fortune-photo: Request received { BUILD_TAG: '...' }`
   - `[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED`
   - `finalize-fortune-photo: SIGNED_URL_OK`

### Build Tag Verification
1. [ ] Check `BUILD_TAG` value in function logs
2. [ ] Compare with `BUILD_TAG` constant in repo source code:
   - `issue-fortune-upload-ticket`: `'2026-01-13-put-contract'`
   - `finalize-fortune-photo`: `'2025-01-27T00:00:00Z-finalize-fortune-photo'`
3. [ ] If mismatch, redeploy edge functions (see `docs/EDGE_FUNCTIONS_DEPLOYMENT.md`):
   ```bash
   supabase functions deploy issue-fortune-upload-ticket
   supabase functions deploy finalize-fortune-photo
   ```

### Response Payload Check
1. [ ] Call `issue-fortune-upload-ticket` and verify response includes:
   - `buildTag` field (value: `'2026-01-13-put-contract'`)
   - `uploadMethod: 'PUT'`
   - `headers.Content-Type` matching requested MIME type
   - `headers.x-upsert: 'true'`
   - (NO `formFieldName` field)
2. [ ] Call `finalize-fortune-photo` and verify response includes:
   - `buildTag` field (value: `'2025-01-27T00:00:00Z-finalize-fortune-photo'`)
   - `media.updated_at` field

### Access Control Verification
1. [ ] Test with user having `status='active', is_lifetime=false` → ✅ Should allow
2. [ ] Test with user having `status='trialing', is_lifetime=false` → ✅ Should allow
3. [ ] Test with user having `status='active', is_lifetime=true` → ✅ Should allow
4. [ ] Test with user having `status='past_due'` → ❌ Should deny
5. [ ] Test with user having `status='canceled'` → ❌ Should deny
6. [ ] Test with user in trial period (`trial_ends_at > NOW()`) → ✅ Should allow

### Database Verification
1. [ ] After upload, check `fortune_media` table:
   ```sql
   SELECT fortune_id, bucket, path, updated_at 
   FROM fortune_media 
   WHERE fortune_id = '<test-fortune-id>';
   ```
2. [ ] Verify `path` is bucket-relative (no `photos/` prefix)
3. [ ] Verify `updated_at` is recent timestamp
4. [ ] Replace photo and verify `updated_at` changes

## Common Issues & Fixes

### Issue: Upload succeeds but file not in bucket
- **Symptoms**: `finalize-fortune-photo` returns `UPLOAD_NOT_PERSISTED`
- **Cause**: Client using `PUT` instead of `POST multipart`
- **Fix**: Ensure client uses `POST` with `multipart/form-data` and field name `file`

### Issue: Photo doesn't refresh in Today's Fortunes
- **Symptoms**: New photo shows in modal but not in list until manual refresh
- **Cause**: `fortunesUpdated` event not dispatched or not received
- **Fix**: Verify `FortuneModal` dispatches event after finalize, verify `HomeTab` and `FortunePhoto` listen for event

### Issue: Cache-busting not working
- **Symptoms**: Old photo still shows after replacement
- **Cause**: `useSignedUrl` not using `updated_at` as version
- **Fix**: Verify `FortunePhoto` passes `media.version` (from `updated_at`) to `useSignedUrl`

### Issue: BUILD_TAG mismatch
- **Symptoms**: Logs show different `BUILD_TAG` than repo
- **Cause**: Functions not redeployed after code change
- **Fix**: Redeploy edge functions

## Production Deployment Steps

1. [ ] Update `BUILD_TAG` in both edge function files (if changed):
   - `supabase/functions/issue-fortune-upload-ticket/index.ts`
   - `supabase/functions/finalize-fortune-photo/index.ts`
2. [ ] Deploy edge functions (see `docs/EDGE_FUNCTIONS_DEPLOYMENT.md` for full guide):
   ```bash
   supabase functions deploy issue-fortune-upload-ticket
   supabase functions deploy finalize-fortune-photo
   ```
3. [ ] Verify deployment using BUILD_TAG check (see Build Tag Verification section above)
4. [ ] Verify deployment in Supabase Dashboard → Edge Functions → Logs
5. [ ] Run verification checklist above
6. [ ] Monitor logs for errors during first 24 hours
