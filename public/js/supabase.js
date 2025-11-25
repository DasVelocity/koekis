const supabaseUrl = 'https://xbfwmzcsnloptzqcyftdk.supabase.co';
const supabaseKey = 'sb_publishable_JsXdy0x7-bt02y83sVyFyQ_FI55P9bB';
const { createClient } = Supabase;
export const supabase = createClient(supabaseUrl, supabaseKey);
