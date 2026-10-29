const SUPABASE_URL = "https://vebclaatwtxueqhxsogw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_q3RXiSmGU9z-7442zeN7mw_DHXBACWv";


window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log("Supabase client initialised:", !!window.supabaseClient);

