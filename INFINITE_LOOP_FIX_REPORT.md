# Fix Infinite Request Loop - Implementation Report

**Date:** 2026-01-18  
**Task:** Fix infinite loop of requests to `/auth/v1/user`, `/rest/v1/rpc/fortune_list`, and `PATCH /rest/v1/profiles`

## Summary

Successfully implemented a centralized `fortune_list` fetcher with robust guards to prevent infinite loops. All requests now only occur:
- On app start once (initial bootstrap)
- On explicit user gestures (pull-to-refresh / button clicks)
- With a 30-second minimum debounce between automatic calls

## Files Changed

### New Files
1. **`src/lib/fortuneListFetcher.ts`** - Centralized fetcher with guards

### Modified Files
1. **`src/lib/fortunes.ts`** - Updated to use centralized fetcher
2. **`src/components/HomeTab.tsx`** - Updated to use force flag appropriately
3. **`src/components/InsightsTab.tsx`** - Separated filtering from fetching
4. **`src/components/FortuneModal.tsx`** - Uses centralized fetcher with force=true
5. **`src/components/LuxuryAvatarSection.tsx`** - Added guard to prevent profile update loops
6. **`src/hooks/useAppBootstrap.ts`** - Fixed dependency loop in useEffect

## Implementation Details

### TASK A - Fix Infinite Request Loop

#### 1. Centralized `fetchFortuneList()` Function
**File:** `src/lib/fortuneListFetcher.ts`

**Guards Implemented:**
- ✅ **In-flight lock**: `fetchState.inFlight` prevents concurrent calls
- ✅ **Debounce guard**: `fetchState.lastFetchAt` with 30-second minimum
- ✅ **Auth check**: Verifies user exists before fetching
- ✅ **Clear logging**: `[FORTUNE_LIST] fetch start`, `skip: inflight`, `skip: debounce`, `done`

**Key Features:**
```typescript
const fetchState = {
  inFlight: false,
  lastFetchAt: 0,
  DEBOUNCE_MS: 30000, // 30 seconds minimum
};
```

#### 2. Updated All Callers

**HomeTab.tsx:**
- ✅ `fetchRecentFortunes()` now accepts `force` parameter
- ✅ Only `force=true` on:
  - `refreshTrigger > 0` (explicit user refresh)
  - `fortunesUpdated` event (user action)
  - `handleLevelUp()` (user action)
- ✅ Initial mount uses `force=false` (respects debounce)

**InsightsTab.tsx:**
- ✅ Separated date filtering from fetching
- ✅ `selectedDate` changes no longer trigger new fetches
- ✅ Only `force=true` on `refreshTrigger > 0` or user actions
- ✅ Filtering happens client-side on existing data

**FortuneModal.tsx:**
- ✅ `loadBigWinsCount()` uses centralized fetcher
- ✅ `force=true` when user opens modal (user action)
- ✅ No longer calls `fortune_list` directly

#### 3. Fixed useAppBootstrap Loop
**File:** `src/hooks/useAppBootstrap.ts`

**Changes:**
- ✅ Use `user.id` as stable dependency instead of entire `user` object
- ✅ Use `bootstrapRef` to access latest bootstrap function
- ✅ Guard with `userIdRef` to prevent multiple calls for same user
- ✅ Prevents bootstrap from re-running when user object reference changes

#### 4. Fixed LuxuryAvatarSection Profile Update Loop
**File:** `src/components/LuxuryAvatarSection.tsx`

**Changes:**
- ✅ Added `levelUpdateInProgressRef` to prevent re-triggering
- ✅ Profile updates no longer cause `fortune_list` to be called again
- ✅ Guard prevents loop when profile level updates trigger re-render

### TASK B - Ensure Upload Ticket Only on Click

**Verification:**
- ✅ `issue-fortune-upload-ticket` only called in:
  - `handleAttachPhoto()` onClick handler (FortuneModal.tsx line 890)
  - `input.onchange` event handler (nativeUploader.ts line 13)
- ✅ No calls in `useEffect` or derived effects
- ✅ Already has `ticketRequested` ref guard to prevent duplicate requests

## Request Flow After Fix

### Before Fix (Infinite Loop):
```
useEffect → fetchFortunes() → fortune_list → setState → re-render → useEffect → ...
```

### After Fix (Controlled):
```
Initial Mount → fetchFortunes(force=false) → [FORTUNE_LIST] fetch start → done
User Action → fetchFortunes(force=true) → [FORTUNE_LIST] fetch start → done
Auto Refresh → fetchFortunes(force=false) → [FORTUNE_LIST] skip: debounce (if < 30s)
```

## Testing Checklist

- [ ] App starts without infinite requests
- [ ] Pull-to-refresh works (force=true)
- [ ] Button clicks trigger refresh (force=true)
- [ ] No requests when user is not active
- [ ] Profile updates don't trigger fortune_list
- [ ] 30-second debounce is respected
- [ ] Upload ticket only requested on photo button click

## Logging

All fortune_list calls now log:
- `[FORTUNE_LIST] fetch start` - When fetch begins
- `[FORTUNE_LIST] skip: inflight` - If already fetching
- `[FORTUNE_LIST] skip: debounce` - If within 30s debounce window
- `[FORTUNE_LIST] skip: no user` - If user not authenticated
- `[FORTUNE_LIST] done` - When fetch completes successfully

## Next Steps

1. Monitor Supabase logs to verify requests have stopped
2. Test on production to ensure no regressions
3. Consider adding AppState listener for foreground resume (if needed)
