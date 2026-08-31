/**
 * Supabase Client Configuration
 * 
 * This module creates the Supabase client for the frontend.
 * Uses @supabase/ssr for proper Next.js App Router integration.
 * 
 * Why: Supabase handles authentication, database, and real-time subscriptions.
 * The client is configured with environment variables for the project URL and keys.
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client for client-side operations
 * 
 * This client is used in client components for:
 * - Authentication (login, register, logout)
 * - Real-time subscriptions
 * - Client-side data fetching
 * 
 * Note: For server components, use createServerClient from @supabase/ssr
 */
export function createClient() {
  // Ensure environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:');
    console.error('- NEXT_PUBLIC_SUPABASE_URL');
    console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
    throw new Error('Supabase configuration missing');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Helper to get current user
 * Returns the authenticated user or null
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  
  return user;
}

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}
