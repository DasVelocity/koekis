import { supabase } from "./supabase.js";

// Make sure supabase.js correctly exports 'supabase' object initialized with your credentials

export async function uploadFile(file) {
    if (!file) return null;
    const fileName = `${Date.now()}_${file.name}`;
    try {
        const { data, error } = await supabase.storage
            .from('media') // Ensure this is your bucket name
            .upload(`media/${fileName}`, file);

        if (error) {
            console.error("Supabase Storage Error:", error);
            // This is often triggered by CORS/Network issues
            alert("Upload failed. Check your network connection and Supabase CORS settings.");
            return null;
        }

        const { data: publicURLData } = supabase
            .storage
            .from('media')
            .getPublicUrl(data.path);
            
        return publicURLData.publicUrl;
    } catch (e) {
        console.error("Network Error during upload:", e);
        alert("Upload failed due to a network or CORS error. Please fix the CORS configuration in your Supabase storage dashboard.");
        return null;
    }
}
