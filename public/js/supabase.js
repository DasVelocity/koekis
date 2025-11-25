const supabaseUrl = 'https://xbfwmzcsnloptzqcyftdk.supabase.co';
const supabaseKey = 'sb_publishable_JsXdy0x7-bt02y83sVyFyQ_FI55P9bB';   // ← THIS ONE

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
export const supabase = createClient(supabaseUrl, supabaseKey);