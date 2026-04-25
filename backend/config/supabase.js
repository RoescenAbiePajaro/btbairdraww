import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// Initialize Supabase client with service role for backend operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE || process.env.SUPABASE_ANON_KEY
);

// Initialize Supabase client for frontend (if needed in backend)
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export { supabase, supabasePublic };
