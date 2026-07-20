import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kankkczbspmckzoufffq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_4jzMMz3xL3OBCA26KRvgTg_lD9v_Q2R';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
