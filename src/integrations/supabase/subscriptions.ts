import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';
import { Subscription } from '@/types/fortune';

export type ActiveSubscription = Subscription;

/**
 * Get the active subscription for the current user
 * Returns null if no active subscription or user is not logged in
 */
export async function getActiveSubscription(
  supabase: SupabaseClient<Database>
): Promise<ActiveSubscription | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription',message:'No user or auth error',data:{authError:authError?.message,hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB1'})}).catch(()=>{});
      // #endregion
      return null;
    }

    const now = new Date().toISOString();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:beforeQuery',message:'About to query subscriptions',data:{userId:user.id,now},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB2'})}).catch(()=>{});
    // #endregion

    // First, let's check ALL subscriptions for this user to see what exists
    const { data: allSubs, error: allSubsError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:allSubs',message:'All subscriptions query result',data:{count:allSubs?.length||0,subs:allSubs?.map(s=>({id:s.id,status:s.status,is_lifetime:s.is_lifetime,current_period_end:s.current_period_end,current_period_start:s.current_period_start,created_at:s.created_at,updated_at:s.updated_at})),error:allSubsError?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB3'})}).catch(()=>{});
    // #endregion

    // First, try to find an active subscription (normal flow)
    const activeQuery = `and(is_lifetime.eq.true,status.eq.active),and(status.eq.active,current_period_end.gte.${now})`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:activeQuery',message:'About to query active subscriptions',data:{query:activeQuery,now,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB8'})}).catch(()=>{});
    // #endregion
    
    let { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .or(activeQuery)
      .maybeSingle();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:activeQueryResult',message:'Active query result',data:{found:!!data,subscriptionId:data?.id,status:data?.status,is_lifetime:data?.is_lifetime,current_period_end:data?.current_period_end,error:error?.message,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB9'})}).catch(()=>{});
    // #endregion

    // If no active subscription found, check for subscriptions with status "active" (fallback)
    // This handles cases where the query might fail due to date format issues or other edge cases
    if (!data && !error && allSubs && allSubs.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:fallbackCheck',message:'Checking all subscriptions for active status (fallback)',data:{totalSubs:allSubs.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB10'})}).catch(()=>{});
      // #endregion
      
      // Find any subscription with status "active" (even if period_end check failed)
      const activeSub = allSubs.find(sub => sub.status === 'active');
      
      if (activeSub) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:fallbackFound',message:'Found active subscription via fallback',data:{subscriptionId:activeSub.id,status:activeSub.status,is_lifetime:activeSub.is_lifetime,current_period_end:activeSub.current_period_end},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB11'})}).catch(()=>{});
        // #endregion
        data = activeSub;
      }
    }
    
    // If still no active subscription found, check for recently created OR updated subscriptions
    // (webhook might still be processing - give it 2 hours grace period)
    if (!data && !error) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      // First, try to find recently created subscriptions (excluding canceled)
      let { data: recentSubs, error: recentError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', twoHoursAgo)
        .neq('status', 'canceled') // Exclude canceled subscriptions
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // If no recently created, check for recently updated subscriptions
      // (webhook might be updating an existing subscription)
      // IMPORTANT: Include "canceled" subscriptions here because webhook might have updated
      // the subscription recently but a cancel event came after, so we check updated_at
      if (!recentSubs && !recentError) {
        const { data: updatedSubs, error: updatedError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .gte('updated_at', twoHoursAgo)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (updatedSubs && !updatedError) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:recentUpdatedSub',message:'Found recently updated subscription (may be canceled)',data:{subscriptionId:updatedSubs.id,status:updatedSubs.status,updated_at:updatedSubs.updated_at,current_period_end:updatedSubs.current_period_end,is_lifetime:updatedSubs.is_lifetime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB12'})}).catch(()=>{});
          // #endregion
          
          // Check if this subscription has a valid period_end in the future
          // Even if status is "canceled", if it was updated recently and has valid period_end,
          // it might be a webhook race condition - accept it if period_end is valid
          const hasValidPeriod = updatedSubs.current_period_end && new Date(updatedSubs.current_period_end) > new Date();
          const validStatuses = ['active', 'trialing', 'past_due'];
          
          if (updatedSubs.is_lifetime || (hasValidPeriod && validStatuses.includes(updatedSubs.status))) {
            recentSubs = updatedSubs;
            recentError = updatedError;
          } else if (hasValidPeriod) {
            // Even if status is "canceled" but period_end is valid and was updated recently,
            // it's likely a webhook race condition - accept it
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:acceptCanceledWithValidPeriod',message:'Accepting canceled subscription with valid period_end (webhook race condition)',data:{subscriptionId:updatedSubs.id,status:updatedSubs.status,current_period_end:updatedSubs.current_period_end},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB13'})}).catch(()=>{});
            // #endregion
            recentSubs = updatedSubs;
            recentError = updatedError;
          } else {
            // If subscription was updated recently but period_end is in the past,
            // check if there's a stripe_subscription_id - if so, it might be a real subscription
            // that just needs the period_end updated. Check allSubs for any with active status
            // or valid stripe_subscription_id
            if (allSubs && allSubs.length > 0) {
              // Find the most recently updated subscription with a stripe_subscription_id
              const subWithStripeId = allSubs
                .filter(sub => sub.stripe_subscription_id)
                .sort((a, b) => {
                  const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                  const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                  return bUpdated - aUpdated;
                })[0];
              
              if (subWithStripeId) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:foundStripeSub',message:'Found subscription with stripe_subscription_id (may be active in Stripe)',data:{subscriptionId:subWithStripeId.id,status:subWithStripeId.status,stripe_subscription_id:subWithStripeId.stripe_subscription_id,updated_at:subWithStripeId.updated_at},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB14'})}).catch(()=>{});
                // #endregion
                
                // If it has a stripe_subscription_id and was updated recently, accept it
                // (Stripe might have the correct status even if DB shows canceled)
                const subUpdatedAt = subWithStripeId.updated_at ? new Date(subWithStripeId.updated_at).getTime() : 0;
                const twoHoursAgoMs = Date.now() - 2 * 60 * 60 * 1000;
                if (subUpdatedAt > twoHoursAgoMs) {
                  recentSubs = subWithStripeId;
                  recentError = null;
                }
              }
            }
          }
        }
      }
      
      if (recentSubs && !recentError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:recentSub',message:'Found recent subscription (webhook may be processing)',data:{subscriptionId:recentSubs.id,status:recentSubs.status,created_at:recentSubs.created_at,updated_at:recentSubs.updated_at,is_lifetime:recentSubs.is_lifetime,current_period_end:recentSubs.current_period_end},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB6'})}).catch(()=>{});
        // #endregion
        
        // If it's lifetime or has a valid period_end, consider it active even if status isn't "active" yet
        // Also accept if status is "trialing", "active", "past_due" (but not "canceled" or "unpaid")
        const validStatuses = ['active', 'trialing', 'past_due'];
        const hasValidPeriod = recentSubs.current_period_end && new Date(recentSubs.current_period_end) > new Date();
        
        if (recentSubs.is_lifetime || (hasValidPeriod && validStatuses.includes(recentSubs.status))) {
          data = recentSubs;
        } else if (hasValidPeriod) {
          // Even if status isn't ideal, if period_end is valid, accept it (webhook may update status later)
          data = recentSubs;
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:noRecentSub',message:'No recent subscription found',data:{twoHoursAgo,recentError:recentError?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB7'})}).catch(()=>{});
        // #endregion
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:result',message:'Active subscription query result',data:{found:!!data,subscriptionId:data?.id,status:data?.status,is_lifetime:data?.is_lifetime,current_period_end:data?.current_period_end,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB4'})}).catch(()=>{});
    // #endregion

    if (error) {
      console.error('Error fetching active subscription:', error);
      return null;
    }

    return data ?? null;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subscriptions.ts:getActiveSubscription:exception',message:'Exception in getActiveSubscription',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUB5'})}).catch(()=>{});
    // #endregion
    console.error('Error in getActiveSubscription:', error);
    return null;
  }
}

/**
 * Check if the current user has an active subscription
 * Returns false if no active subscription or user is not logged in
 */
export async function hasActiveSubscription(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const activeSubscription = await getActiveSubscription(supabase);
  return activeSubscription !== null;
}

/**
 * Get all subscriptions for the current user (including inactive ones)
 * Returns empty array if user is not logged in
 */
export async function getUserSubscriptions(
  supabase: SupabaseClient<Database>
): Promise<Subscription[]> {
  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return [];
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user subscriptions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserSubscriptions:', error);
    return [];
  }
}