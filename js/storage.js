async function uploadImageToSupabase(file) {
    // Create a unique file name to prevent overwriting
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `locations/${fileName}`;

    // Upload the file to the 'water_images' bucket using the renamed client
    const { data, error } = await supabaseClient.storage
        .from('water_images')
        .upload(filePath, file);

    if (error) {
        throw new Error(error.message || 'Failed to upload image to Supabase');
    }

    // Get the public URL for the uploaded image
    const { data: publicUrlData } = supabaseClient.storage
        .from('water_images')
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}