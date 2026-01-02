import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Input validation constants
const MAX_TEXT_LENGTH = 10000
const MAX_CATEGORY_LENGTH = 100
const MIN_FORTUNE_VALUE = 0
const MAX_FORTUNE_VALUE = 1000000

// Allowed category values (General + can be custom)
const DEFAULT_CATEGORIES = ['General', 'Work', 'Health', 'Relationships', 'Finance', 'Personal']

interface FortuneInsertRequest {
  text: string
  category: string
  fortune_value?: number
  created_at?: string
}

interface FortuneInsertResponse {
  success: boolean
  error?: string
  error_code?: string
  data?: any
}

// Input validation helper
function validateFortuneInput(body: FortuneInsertRequest): { valid: boolean; error?: string } {
  // Validate text
  if (!body.text || typeof body.text !== 'string') {
    return { valid: false, error: 'Text is required and must be a string' }
  }
  if (body.text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' }
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text must be ${MAX_TEXT_LENGTH} characters or less` }
  }

  // Validate category
  if (!body.category || typeof body.category !== 'string') {
    return { valid: false, error: 'Category is required and must be a string' }
  }
  if (body.category.trim().length === 0) {
    return { valid: false, error: 'Category cannot be empty' }
  }
  if (body.category.length > MAX_CATEGORY_LENGTH) {
    return { valid: false, error: `Category must be ${MAX_CATEGORY_LENGTH} characters or less` }
  }
  // Block HTML/script injection in category
  if (/<script|<\/script|javascript:/i.test(body.category)) {
    return { valid: false, error: 'Invalid category format' }
  }

  // Validate fortune_value if provided
  if (body.fortune_value !== undefined && body.fortune_value !== null) {
    if (typeof body.fortune_value !== 'number' || isNaN(body.fortune_value)) {
      return { valid: false, error: 'Fortune value must be a number' }
    }
    if (body.fortune_value < MIN_FORTUNE_VALUE || body.fortune_value > MAX_FORTUNE_VALUE) {
      return { valid: false, error: `Fortune value must be between ${MIN_FORTUNE_VALUE} and ${MAX_FORTUNE_VALUE}` }
    }
  }

  // Validate created_at if provided (ISO 8601 date format)
  if (body.created_at !== undefined && body.created_at !== null) {
    if (typeof body.created_at !== 'string') {
      return { valid: false, error: 'Created at must be a valid date string' }
    }
    const date = new Date(body.created_at)
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Created at must be a valid ISO 8601 date' }
    }
    // Prevent future dates more than 1 day ahead
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (date > tomorrow) {
      return { valid: false, error: 'Created at cannot be in the future' }
    }
  }

  return { valid: true }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client using service role for validation
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

    // Parse request body
    const body: FortuneInsertRequest = await req.json()

    // Validate input
    const validation = validateFortuneInput(body)
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: validation.error,
        error_code: 'VALIDATION_ERROR'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Sanitize text - trim whitespace
    const sanitizedText = body.text.trim()
    const sanitizedCategory = body.category.trim()

    // Constants for free plan limits
    const FREE_TRIAL_DAYS = 60
    const FREE_TRIAL_FORTUNE_LIMIT = 100
    const FREE_RESTRICTED_DAILY_LIMIT = 1

    // Check if user has active subscription
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('current_period_end', new Date().toISOString())
      .maybeSingle()

    // If user has active subscription, skip limit checks
    if (subscription) {
      const { data, error } = await supabaseClient
        .from('fortunes')
        .insert([{
          user_id: user.id,
          text: sanitizedText,
          category: sanitizedCategory,
          fortune_value: body.fortune_value ?? null,
          created_at: body.created_at || new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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

    // Get total fortunes count
    const { count: totalFortunes } = await supabaseClient
      .from('fortunes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Determine if user has full access
    const hasFullAccess = isWithinTrialPeriod && (totalFortunes || 0) < FREE_TRIAL_FORTUNE_LIMIT

    if (hasFullAccess) {
      // User has full access, insert fortune
      const { data, error } = await supabaseClient
        .from('fortunes')
        .insert([{
          user_id: user.id,
          text: sanitizedText,
          category: sanitizedCategory,
          fortune_value: body.fortune_value ?? null,
          created_at: body.created_at || new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, data }), {
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

    // Check if user has exceeded daily limit
    if ((dailyFortunesAdded || 0) >= FREE_RESTRICTED_DAILY_LIMIT) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Daily limit reached',
        error_code: 'FREE_DAILY_LIMIT_REACHED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429
      })
    }

    // User can still add fortune today
    const { data, error } = await supabaseClient
      .from('fortunes')
      .insert([{
        user_id: user.id,
        text: sanitizedText,
        category: sanitizedCategory,
        fortune_value: body.fortune_value ?? null,
        created_at: body.created_at || new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in validate-and-insert-fortune:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'An error occurred while processing your request'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
