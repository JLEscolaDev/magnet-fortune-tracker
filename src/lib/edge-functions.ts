import { supabase } from '@/integrations/supabase/client';

export interface EdgeFunctionResponse<T = any> {
  data?: T;
  error?: string;
}

export const callEdge = async <T = any>(
  functionName: string,
  body: any = {}
): Promise<EdgeFunctionResponse<T>> => {
  try {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `https://pegiensgnptpdnfopnoj.supabase.co/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }

    return { data: result };
  } catch (error) {
    console.error(`Error calling edge function ${functionName}:`, error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};