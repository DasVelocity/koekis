import { supabase } from './supabase.js';

export async function uploadFile(file) {
  if (!file) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36)}.${fileExt}`;

  const { error } = await supabase.storage
    .from('media')    
    .upload(fileName, file);

  if (error) {
    console.error(error);
    alert('Upload failed');
    return null;
  }

  const { data } = supabase.storage
    .from('media')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
