# Fortune Photo Refresh Fix

## Problem
After updating/replacing a fortune image, the "Today's Fortunes" list continued to show the old image until a manual page refresh. The cache-busting query param using `media.version` wasn't effective because:

1. The `fortune_media.updated_at` timestamp wasn't explicitly updated in `finalize-fortune-photo`
2. `useSignedUrl` cached signed URLs by `bucket:path` only, ignoring version changes
3. `FortunePhoto` component didn't refetch media when the image was updated
4. No query invalidation was triggered after photo upload completed

## Solution

### 1. Database Update (`supabase/functions/finalize-fortune-photo/index.ts`)
- **Change**: Explicitly set `updated_at` timestamp when updating existing fortune media records
- **Impact**: Ensures the `updated_at` field changes on every update, which serves as the version for cache-busting

```typescript
.update({
  bucket,
  path: bucketRelativePath,
  width: width || null,
  height: height || null,
  size_bytes: size_bytes || null,
  mime_type: mime,
  updated_at: new Date().toISOString() // Explicitly update timestamp for cache busting
})
```

### 2. Signed URL Cache Key (`src/hooks/useSignedUrl.ts`)
- **Change**: Added `version` parameter to `useSignedUrl` hook and include it in cache key
- **Impact**: When version changes, old cache entries are invalidated and a new signed URL is fetched

```typescript
// Cache key now includes version: `${bucket}:${path}:${version}`
const key = version ? `${bucket}:${path}:${version}` : `${bucket}:${path}`;

// When version changes, clear old cache entries
if (version) {
  for (const [cacheKey] of urlCache.entries()) {
    if (cacheKey.startsWith(`${bucket}:${path}:`) || cacheKey === `${bucket}:${path}`) {
      urlCache.delete(cacheKey);
    }
  }
}
```

### 3. FortunePhoto Component Refresh (`src/components/FortunePhoto.tsx`)
- **Change**: Listen for `fortunesUpdated` events to refetch media when image changes
- **Impact**: Component automatically refetches media metadata when photo upload completes

```typescript
// Listen for fortune updates to refetch media when photo changes
const handleFortuneUpdate = () => {
  if (!cancelled) {
    loadMedia();
  }
};

window.addEventListener("fortunesUpdated", handleFortuneUpdate);
```

### 4. Query Invalidation (`src/components/FortuneModal.tsx`)
- **Change**: Dispatch `fortunesUpdated` event after photo upload completes
- **Impact**: Triggers refresh of fortunes list and all `FortunePhoto` components

```typescript
// After successful upload (immediate or after polling)
window.dispatchEvent(new Event("fortunesUpdated"));
onFortuneUpdated?.();
```

## Files Changed

1. `supabase/functions/finalize-fortune-photo/index.ts` - Explicit `updated_at` update
2. `src/hooks/useSignedUrl.ts` - Version-aware cache invalidation
3. `src/components/FortunePhoto.tsx` - Event listener for media refresh
4. `src/components/FortuneModal.tsx` - Trigger refresh events after upload

## Reproduction Steps

### Before Fix
1. Open app with a fortune that has a photo in "Today's Fortunes" list
2. Edit the fortune and replace the photo with a new image
3. Save the fortune
4. **Observed**: The list still shows the old image until manual page refresh

### After Fix
1. Open app with a fortune that has a photo in "Today's Fortunes" list
2. Edit the fortune and replace the photo with a new image
3. Save the fortune
4. **Expected**: The list immediately shows the new image (no manual refresh needed)

## Verification

### Manual Testing
1. ✅ Upload a new photo to a fortune
2. ✅ Verify photo appears in "Today's Fortunes" list immediately
3. ✅ Replace photo with a different image
4. ✅ Verify new photo appears in list without page refresh
5. ✅ Check browser dev tools: image `src` URL should have different `v=` query param after update

### Database Verification
```sql
-- Check that updated_at changes when photo is replaced
SELECT fortune_id, path, updated_at 
FROM fortune_media 
WHERE fortune_id = '<test_fortune_id>' 
ORDER BY updated_at DESC;
```

### Cache Verification
- Open browser dev tools → Network tab
- Filter by image requests
- Upload/replace a photo
- Verify new image request has different `v=` query param
- Verify old signed URL cache entry was invalidated

## Technical Details

### Cache Flow
1. **Initial Load**: `FortunePhoto` fetches media → gets `updated_at` → uses as version → calls `useSignedUrl(bucket, path, 300, version)`
2. **Cache Key**: `${bucket}:${path}:${version}` (e.g., `photos:userId/fortuneId-abc123.jpg:2024-01-12T10:30:00Z`)
3. **On Update**: `finalize-fortune-photo` sets new `updated_at` → triggers `fortunesUpdated` event → `FortunePhoto` refetches → gets new version → invalidates old cache → fetches new signed URL
4. **Browser Cache**: Query param `v=<version>` ensures browser doesn't use cached image

### Event Flow
1. User uploads/replaces photo → `finalize-fortune-photo` completes
2. `FortuneModal` dispatches `fortunesUpdated` event
3. `HomeTab` receives event → refetches fortunes list
4. `FortunePhoto` components receive event → refetch media → update version → invalidate cache → fetch new signed URL
5. Browser loads new image with updated `src` URL

## Rollback Plan

If issues arise, revert these changes:
1. Remove explicit `updated_at` from `finalize-fortune-photo` (rely on DB trigger)
2. Remove `version` parameter from `useSignedUrl` hook
3. Remove event listener from `FortunePhoto` component
4. Remove event dispatch from `FortuneModal` component

The app will function but will require manual refresh to see updated images.
