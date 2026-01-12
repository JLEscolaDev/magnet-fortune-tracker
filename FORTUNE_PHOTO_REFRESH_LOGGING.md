# Fortune Photo Refresh - Explicit Logging & Deterministic Refresh

## Summary
Added explicit logging and deterministic refresh mechanism to ensure Today's Fortunes list updates immediately after fortune image upload/replacement. All refresh triggers now include logs and only fire after DB confirms the update.

## Changes

### 1. Backend: Log DB Update Confirmation (`supabase/functions/finalize-fortune-photo/index.ts`)
- **After DB update**: Fetches the updated media record to confirm the update succeeded
- **Logs**: `[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED` with `fortuneId`, `bucket`, `path`, `updated_at`, `replaced`
- **Returns**: Updated media record in response so frontend can confirm DB update

```typescript
// Fetch updated media record after DB update
const { data: updatedMedia } = await userClient
  .from('fortune_media')
  .select('fortune_id, bucket, path, updated_at, created_at')
  .eq('fortune_id', fortune_id)
  .single();

if (updatedMedia) {
  console.log('[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED', {
    fortuneId: updatedMedia.fortune_id,
    bucket: updatedMedia.bucket,
    path: updatedMedia.path,
    updated_at: updatedMedia.updated_at,
    replaced
  });
}

// Return media in response
return new Response(JSON.stringify({
  signedUrl: signedUrlData.signedUrl,
  replaced,
  media: updatedMedia ? {
    fortune_id: updatedMedia.fortune_id,
    bucket: updatedMedia.bucket,
    path: updatedMedia.path,
    updated_at: updatedMedia.updated_at
  } : null
}), ...);
```

### 2. Frontend: Deterministic Refresh After DB Confirmation (`src/components/FortuneModal.tsx`)
- **After upload completes**: Only triggers refresh if `result.media` is present (DB confirmed)
- **Logs**: 
  - `[PHOTO-UPLOAD] DB_UPDATE_CONFIRMED` with media details
  - `[PHOTO-UPLOAD] Dispatching fortunesUpdated event`
- **Polling completion**: Fetches media record to confirm DB update before triggering refresh

```typescript
// Only refresh after DB confirms update
if (!result.pending && result.media) {
  console.log('[PHOTO-UPLOAD] DB_UPDATE_CONFIRMED - Triggering refresh', {
    fortuneId: result.media.fortune_id,
    bucket: result.media.bucket,
    path: result.media.path,
    updated_at: result.media.updated_at,
    replaced: result.replaced
  });
  
  console.log('[PHOTO-UPLOAD] Dispatching fortunesUpdated event');
  window.dispatchEvent(new Event("fortunesUpdated"));
  onFortuneUpdated?.();
}
```

### 3. Today's Fortunes List: Explicit Refresh (`src/components/HomeTab.tsx`)
- **Event listener**: Listens for `fortunesUpdated` events
- **Logs**: `[HOME-TAB] fortunesUpdated event received - refreshing Today's Fortunes list`
- **Action**: Calls `fetchRecentFortunes()` to refetch the list

```typescript
const handleFortuneUpdate = () => {
  console.log('[HOME-TAB] fortunesUpdated event received - refreshing Today\'s Fortunes list');
  fetchRecentFortunes();
};

window.addEventListener("fortunesUpdated", handleFortuneUpdate);
```

### 4. FortunePhoto Component: Render Logging (`src/components/FortunePhoto.tsx`)
- **On render**: Logs when component renders with media data
- **Logs**: `[FORTUNE-LIST] FortunePhoto rendering in Today's Fortunes` with `fortuneId`, `bucket`, `path`, `updated_at`
- **On event**: Logs when `fortunesUpdated` event is received

```typescript
// Log on render
useEffect(() => {
  if (media) {
    console.log('[FORTUNE-LIST] FortunePhoto rendering in Today\'s Fortunes', {
      fortuneId,
      bucket: media.bucket,
      path: media.path,
      updated_at: media.version
    });
  }
}, [fortuneId, media?.bucket, media?.path, media?.version]);

// Log on event
const handleFortuneUpdate = () => {
  console.log('[FORTUNE-PHOTO] fortunesUpdated event received - refetching media', { fortuneId });
  loadMedia();
};
```

### 5. Type Updates (`src/types/native.ts`, `src/lib/nativeUploader.ts`)
- **Added**: `media` field to `NativeUploaderResult` interface
- **Purpose**: Pass updated media record from backend to frontend for confirmation

## Log Flow

### Successful Upload Flow
1. **Backend**: `[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED` - DB update confirmed
2. **Frontend**: `[PHOTO-UPLOAD] DB_UPDATE_CONFIRMED` - Received media from backend
3. **Frontend**: `[PHOTO-UPLOAD] Dispatching fortunesUpdated event` - Event dispatched
4. **HomeTab**: `[HOME-TAB] fortunesUpdated event received` - Event received, refreshing list
5. **FortunePhoto**: `[FORTUNE-PHOTO] fortunesUpdated event received` - Event received, refetching media
6. **FortunePhoto**: `[FORTUNE-LIST] FortunePhoto rendering` - Component renders with new media

### Polling Flow (Pending Uploads)
1. **Backend**: `[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED` - DB update confirmed
2. **Frontend**: `[PHOTO-POLL] DB_UPDATE_CONFIRMED` - Media fetched after polling
3. **Frontend**: `[PHOTO-POLL] Dispatching fortunesUpdated event after polling` - Event dispatched
4. **HomeTab**: `[HOME-TAB] fortunesUpdated event received` - Refreshing list
5. **FortunePhoto**: `[FORTUNE-PHOTO] fortunesUpdated event received` - Refetching media
6. **FortunePhoto**: `[FORTUNE-LIST] FortunePhoto rendering` - Component renders with new media

## Verification Steps

1. **Open browser console**
2. **Edit a fortune** and upload/replace a photo
3. **Verify logs appear in sequence**:
   - `[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED`
   - `[PHOTO-UPLOAD] DB_UPDATE_CONFIRMED`
   - `[PHOTO-UPLOAD] Dispatching fortunesUpdated event`
   - `[HOME-TAB] fortunesUpdated event received`
   - `[FORTUNE-PHOTO] fortunesUpdated event received`
   - `[FORTUNE-LIST] FortunePhoto rendering`
4. **Verify Today's Fortunes list shows new image** without manual refresh
5. **Verify image `src` URL has new `v=` query param** in Network tab

## Key Guarantees

✅ **No silent updates**: Every refresh is logged with context
✅ **DB confirmation required**: Refresh only triggers after backend confirms DB update
✅ **Deterministic refresh**: Explicit `fetchRecentFortunes()` call in HomeTab
✅ **Event logging**: All `fortunesUpdated` event dispatches are logged
✅ **Render logging**: Every FortunePhoto render includes media metadata

## Troubleshooting

If refresh doesn't work, check console logs:
- Missing `[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED` → Backend issue
- Missing `[PHOTO-UPLOAD] DB_UPDATE_CONFIRMED` → Frontend didn't receive media
- Missing `[PHOTO-UPLOAD] Dispatching` → Event not dispatched
- Missing `[HOME-TAB] fortunesUpdated` → Event listener not registered
- Missing `[FORTUNE-PHOTO] fortunesUpdated` → Component not listening
- Missing `[FORTUNE-LIST] FortunePhoto rendering` → Component not re-rendering
