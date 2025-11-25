const supabaseUrl = 'https://xbfwmzcsnloptzqcyftdk.supabase.co';
const supabaseKey = 'sb_publishable_JsXdy0x7-bt02y83sVyFyQ_FI55P9bB';

function initSupabase() {
  if (typeof Supabase === 'undefined') {
    setTimeout(initSupabase, 100);  
    return;
  }
  
  const { createClient } = Supabase;
  window.supabase = createClient(supabaseUrl, supabaseKey);  
}

initSupabase();

export const supabase = window.supabase; 
