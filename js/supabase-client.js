// Frontend Supabase Client
// This file initializes the Supabase client for browser-side operations
// Uses the ANON key (safe for frontend) with Row Level Security policies

// Supabase configuration
// IMPORTANT: Replace these with your actual Supabase project credentials
// Get these from: Supabase Dashboard > Settings > API
const SUPABASE_URL = 'https://rcglozgdwegtndqehobz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZ2xvemdkd2VndG5kcWVob2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjUyODAsImV4cCI6MjA4MDM0MTI4MH0.Di1GfiZ-j-a-yAkgelJhTE6x-YHupEAKAZbXNuK6dDs';

// Create and export Supabase client instance
// The anon key is safe to use in the browser because RLS policies protect your data
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { supabase };
}
