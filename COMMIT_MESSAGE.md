fix: Production-ready Stripe billing entitlement and schema fixes

Fix Stripe billing entitlement system to be production-safe with correct
status handling, schema constraints, and view definitions.

Database Migrations:
- 20250125115958: Cleanup duplicate subscriptions and normalize tier values
  * Ensures exactly 1 row per user_id
  * Lifetime subscriptions take precedence
  * Normalizes tier to ['essential','growth','pro','lifetime']
  * Marks legacy active rows without Stripe data as canceled
- 20250125115959: Add UNIQUE constraint on subscriptions.user_id
  * Enforces single-row-per-user model
  * Must run after cleanup migration
- 20250125115960: Fix user_features view with correct access logic
  * Adds missing early_bird_eligible column
  * Fixes has_full_access calculation:
    - Lifetime: is_lifetime=true AND subscription_status='active'
    - Recurring: subscription_status IN ('active','trialing')
    - Trial: is_trial_active(p.user_id)
  * Preserves all existing columns
- 20250125115961: Fix subscriptions.status CHECK constraint
  * Adds support for 'trialing' status (required for Stripe trials)
  * Safely detects and replaces existing status constraints
  * Uses strict pattern matching to avoid dropping unrelated constraints

Key Changes:
- Stripe is now source of truth for recurring subscription status
- Lifetime entitlement explicitly flagged (is_lifetime=true, tier='lifetime')
- Status constraint allows all Stripe subscription statuses including 'trialing'
- user_features view correctly computes access and eligibility flags
- Frontend access control relies on DB status, not frontend-only logic

Validation:
- See docs/POST_DEPLOY_VERIFICATION.sql for post-deploy SQL queries
- All migrations are idempotent and safe to re-run
- Migrations run in correct dependency order
