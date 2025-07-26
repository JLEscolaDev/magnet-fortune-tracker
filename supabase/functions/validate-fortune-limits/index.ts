import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface FortuneValidationRequest {
  user_id: string
}

interface FortuneValidationResponse {
  canAddFortune: boolean
  isRestricted: boolean
  restrictionReason: 'trial_expired' | 'fortune_limit_reached' | 'daily_limit_reached' | null
  message?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    // Constants for free plan limits
    const FREE_TRIAL_DAYS = 60
    const FREE_TRIAL_FORTUNE_LIMIT = 100
    const FREE_RESTRICTED_DAILY_LIMIT = 1

    // Get user profile to check signup date
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('created_at')
      .eq('user_id', user.id)
      .single()

    // Calculate days since signup
    const signupDate = new Date(profile?.created_at || user.created_at)
    const daysSinceSignup = Math.floor((Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24))
    const isWithinTrialPeriod = daysSinceSignup < FREE_TRIAL_DAYS

    // Check if user has active subscription
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('current_period_end', new Date().toISOString())
      .maybeSingle()

    // If user has active subscription, they have unlimited access
    if (subscription) {
      const response: FortuneValidationResponse = {
        canAddFortune: true,
        isRestricted: false,
        restrictionReason: null
      }
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get total fortunes count
    const { count: totalFortunes } = await supabaseClient
      .from('fortunes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Determine if user has full access
    const hasFullAccess = isWithinTrialPeriod && (totalFortunes || 0) < FREE_TRIAL_FORTUNE_LIMIT

    if (hasFullAccess) {
      const response: FortuneValidationResponse = {
        canAddFortune: true,
        isRestricted: false,
        restrictionReason: null
      }
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // User is restricted - check daily limit
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    const { count: dailyFortunesAdded } = await supabaseClient
      .from('fortunes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString())

    // Determine restriction reason and can add fortune
    let restrictionReason: FortuneValidationResponse['restrictionReason'] = null
    let canAddFortune = true
    let message = ''

    if (!isWithinTrialPeriod) {
      restrictionReason = 'trial_expired'
      message = `Your ${FREE_TRIAL_DAYS}-day trial has ended.`
    } else if ((totalFortunes || 0) >= FREE_TRIAL_FORTUNE_LIMIT) {
      restrictionReason = 'fortune_limit_reached'
      message = `You've reached ${FREE_TRIAL_FORTUNE_LIMIT} fortunes.`
    }

    // Check daily limit for restricted users
    if ((dailyFortunesAdded || 0) >= FREE_RESTRICTED_DAILY_LIMIT) {
      restrictionReason = 'daily_limit_reached'
      canAddFortune = false
      message = `You've reached your daily limit of ${FREE_RESTRICTED_DAILY_LIMIT} fortune.`
    }

    const response: FortuneValidationResponse = {
      canAddFortune,
      isRestricted: true,
      restrictionReason,
      message: canAddFortune ? `${message} You can add ${FREE_RESTRICTED_DAILY_LIMIT} fortune per day.` : `${message} Upgrade to Pro or try again tomorrow!`
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error validating fortune limits:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        canAddFortune: false,
        isRestricted: true,
        restrictionReason: null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})