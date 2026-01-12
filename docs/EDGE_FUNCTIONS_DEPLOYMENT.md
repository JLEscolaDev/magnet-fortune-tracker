# Supabase Edge Functions Deployment Guide

**Last Updated**: 2025-01-27

## Deployment Status

❌ **NO automated deployment configured**
- No GitHub Actions workflows
- No deployment scripts in `package.json`
- **Functions must be deployed manually** using Supabase CLI

## Project Configuration

**Supabase Project ID**: `pegiensgnptpdnfopnoj`  
**Project URL**: `https://pegiensgnptpdnfopnoj.supabase.co`

## Prerequisites

1. Install Supabase CLI:
   ```bash
   brew install supabase/tap/supabase  # macOS
   # OR
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link project (if not already linked):
   ```bash
   supabase link --project-ref pegiensgnptpdnfopnoj
   ```

## Deployment Checklist

### Step 1: Pre-Deployment Verification

- [ ] Verify function code changes are committed
- [ ] Check `BUILD_TAG` constants in source code:
  - `supabase/functions/issue-fortune-upload-ticket/index.ts`: `BUILD_TAG = '2026-01-13-put-contract'`
  - `supabase/functions/finalize-fortune-photo/index.ts`: `BUILD_TAG = '2025-01-27T00:00:00Z-finalize-fortune-photo'`
- [ ] Review function logs for any errors before deployment

### Step 2: Deploy Functions

Deploy both functions in order:

```bash
# Deploy issue-fortune-upload-ticket
supabase functions deploy issue-fortune-upload-ticket

# Deploy finalize-fortune-photo
supabase functions deploy finalize-fortune-photo
```

**Alternative: Deploy from local directory**
```bash
cd supabase/functions
supabase functions deploy issue-fortune-upload-ticket --project-ref pegiensgnptpdnfopnoj
supabase functions deploy finalize-fortune-photo --project-ref pegiensgnptpdnfopnoj
```

### Step 3: Verify Deployment

#### 3a) Check Deployment Status

After deployment, you should see:
```
Deploying function issue-fortune-upload-ticket...
Function issue-fortune-upload-ticket deployed successfully.
```

#### 3b) Verify BUILD_TAG in Logs

1. **Trigger a test upload** (via iOS app or Web mock uploader)
2. **Open Supabase Dashboard** → Edge Functions → Logs
3. **Check logs for BUILD_TAG**:
   - Search for: `issue-fortune-upload-ticket: Request received`
   - Verify log includes: `{ BUILD_TAG: '2026-01-13-put-contract' }`
   - Search for: `finalize-fortune-photo: Request received`
   - Verify log includes: `{ BUILD_TAG: '2025-01-27T00:00:00Z-finalize-fortune-photo' }`

#### 3c) Verify BUILD_TAG in Response

**Test `issue-fortune-upload-ticket`:**
```bash
curl -X POST https://pegiensgnptpdnfopnoj.supabase.co/functions/v1/issue-fortune-upload-ticket \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"fortune_id": "<test-fortune-id>", "mime": "image/jpeg"}' \
  | jq '.buildTag'
```

**Expected output:**
```json
"2026-01-13-put-contract"
```

**Test `finalize-fortune-photo`:**
```bash
curl -X POST https://pegiensgnptpdnfopnoj.supabase.co/functions/v1/finalize-fortune-photo \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"fortune_id": "<test-fortune-id>", "bucket": "photos", "path": "<test-path>", "mime": "image/jpeg"}' \
  | jq '.buildTag'
```

**Expected output:**
```json
"2025-01-27T00:00:00Z-finalize-fortune-photo"
```

#### 3d) Verify Function Behavior

- [ ] `issue-fortune-upload-ticket` returns `uploadMethod: "PUT"`
- [ ] `issue-fortune-upload-ticket` returns `headers.Content-Type` matching MIME type
- [ ] `issue-fortune-upload-ticket` returns `headers.x-upsert: "true"`
- [ ] `finalize-fortune-photo` returns `media.updated_at` field
- [ ] Uploads persist correctly in Storage bucket

## Troubleshooting

### Issue: `supabase: command not found`
**Fix**: Install Supabase CLI (see Prerequisites)

### Issue: `Error: Access token is required`
**Fix**: Run `supabase login` to authenticate

### Issue: `Error: Project not found`
**Fix**: Verify project ID in `supabase/config.toml` matches production project

### Issue: BUILD_TAG mismatch in logs
**Cause**: Function not redeployed after code change
**Fix**: Redeploy the function(s) with updated BUILD_TAG

### Issue: Functions deploy but don't update
**Fix**: 
1. Check if you're deploying to correct project: `supabase link --project-ref pegiensgnptpdnfopnoj`
2. Verify deployment completed successfully (check CLI output)
3. Wait 1-2 minutes for propagation, then test again

## Quick Reference

### Deploy Both Functions
```bash
supabase functions deploy issue-fortune-upload-ticket && \
supabase functions deploy finalize-fortune-photo
```

### Check Function Logs
```bash
# Via CLI
supabase functions logs issue-fortune-upload-ticket --project-ref pegiensgnptpdnfopnoj
supabase functions logs finalize-fortune-photo --project-ref pegiensgnptpdnfopnoj

# Via Dashboard
# https://supabase.com/dashboard/project/pegiensgnptpdnfopnoj/functions
```

### Verify BUILD_TAG Quickly
```bash
# Get access token (replace with actual method)
ACCESS_TOKEN="<your-access-token>"

# Test issue-fortune-upload-ticket
curl -s -X POST https://pegiensgnptpdnfopnoj.supabase.co/functions/v1/issue-fortune-upload-ticket \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fortune_id": "00000000-0000-0000-0000-000000000000", "mime": "image/jpeg"}' \
  | jq -r '.buildTag // "NOT_FOUND"'
```

## Future Improvements

Consider setting up automated deployment:

1. **GitHub Actions Workflow**:
   - Deploy functions on push to `main` branch
   - Use Supabase CLI in GitHub Actions
   - Set `SUPABASE_ACCESS_TOKEN` as GitHub secret

2. **Pre-commit Hook**:
   - Update `BUILD_TAG` automatically on commit
   - Include git commit hash in BUILD_TAG

3. **Deployment Script**:
   - Add to `package.json`: `"deploy:functions": "supabase functions deploy ..."`
   - Include verification steps in script
