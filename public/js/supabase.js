const supabaseUrl = 'https://xbfwmzcsnloptzqcyftdk.supabase.co';
const supabaseKey = 'sb_publishable_JsXdy0x7-bt02y83sVyFyQ_FI55P9bB';

let supabaseClient = null;

function waitForSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
  } else {
    setTimeout(waitForSupabase, 50);
  }
}

waitForSupabase();

export const supabase = {
  get storage() {
    if (!supabaseClient) throw new Error("Supabase not ready yet");
    return supabaseClient.storage;
  },
  get auth() {
    if (!supabaseClient) throw new Error("Supabase not ready yet");
    return supabaseClient.auth;
  }
};
